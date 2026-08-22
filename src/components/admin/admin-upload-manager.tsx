"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatUploadByteSize,
  isAcceptedUploadFile,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  type InitializedUpload,
  type UploadTaskStatus,
  type UploadTaskView,
  UPLOAD_CONCURRENCY,
} from "@/lib/uploads";

interface UploadAlbumOption {
  id: string;
  title: string;
}

type LocalUploadStatus =
  "queued" | "uploading" | "processing" | "succeeded" | "failed" | "cancelled";

interface LocalUploadItem {
  key: string;
  file: File;
  uploadId?: string;
  status: LocalUploadStatus;
  progress: number;
  error?: string;
  deduplicated?: boolean;
}

const STATUS_LABELS: Record<UploadTaskStatus, string> = {
  PENDING: "等待上传",
  UPLOADED: "等待处理",
  PROCESSING: "正在处理",
  SUCCEEDED: "已完成",
  FAILED: "失败",
};

function localKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}:${crypto.randomUUID()}`;
}

async function responseJson<T>(response: Response): Promise<T> {
  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null && "error" in result
        ? String(result.error)
        : "请求失败，请稍后重试。";
    throw new Error(message);
  }

  return result as T;
}

function uploadToR2(file: File, upload: InitializedUpload, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", upload.presignedUrl);
    request.setRequestHeader("Content-Type", upload.contentType);
    request.setRequestHeader("Cache-Control", upload.cacheControl);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`R2 上传失败（HTTP ${request.status}）。`));
      }
    });
    request.addEventListener("error", () => {
      reject(new Error("无法上传到 R2，请检查私有 Bucket 的 CORS 配置。"));
    });
    request.addEventListener("abort", () => reject(new Error("上传已取消。")));
    request.send(file);
  });
}

function taskClass(status: UploadTaskStatus) {
  return `admin-upload-status admin-upload-status-${status.toLowerCase()}`;
}

export function AdminUploadManager({
  albums,
  initialTasks,
  initialAlbumId,
}: {
  albums: UploadAlbumOption[];
  initialTasks: UploadTaskView[];
  initialAlbumId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState(
    initialAlbumId && albums.some((album) => album.id === initialAlbumId)
      ? initialAlbumId
      : (albums[0]?.id ?? ""),
  );
  const [queue, setQueue] = useState<LocalUploadItem[]>([]);
  const [tasks, setTasks] = useState(initialTasks);
  const [dragActive, setDragActive] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [starting, setStarting] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [reuploadUrls, setReuploadUrls] = useState<Record<string, InitializedUpload>>({});

  const updateQueue = useCallback((key: string, values: Partial<LocalUploadItem>) => {
    setQueue((current) =>
      current.map((item) => (item.key === key ? { ...item, ...values } : item)),
    );
  }, []);

  const refreshTasks = useCallback(async () => {
    const result = await responseJson<{ tasks: UploadTaskView[] }>(
      await fetch("/api/admin/uploads", { cache: "no-store" }),
    );
    setTasks(result.tasks);
  }, []);

  useEffect(() => {
    if (!tasks.some((task) => task.status === "PROCESSING" || task.status === "UPLOADED")) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshTasks().catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [refreshTasks, tasks]);

  const workInProgress =
    starting ||
    queue.some((item) => item.status === "uploading" || item.status === "processing") ||
    tasks.some((task) => task.status === "PROCESSING") ||
    retryingIds.size > 0;

  useEffect(() => {
    if (!workInProgress) {
      return;
    }

    const preventLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventLeave);
    return () => window.removeEventListener("beforeunload", preventLeave);
  }, [workInProgress]);

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    setBatchError("");
    setQueue((current) => {
      const active = current.filter((item) => item.status !== "cancelled");
      const room = Math.max(0, MAX_UPLOAD_FILES - active.length);
      const accepted: LocalUploadItem[] = [];
      const errors: string[] = [];

      for (const file of files.slice(0, room)) {
        if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
          errors.push(`${file.name} 超过 60MB 或为空文件`);
        } else if (!isAcceptedUploadFile(file.name, file.type)) {
          errors.push(`${file.name} 的格式或 Content-Type 不受支持`);
        } else {
          accepted.push({ key: localKey(file), file, status: "queued", progress: 0 });
        }
      }

      if (files.length > room) {
        errors.push(`每批最多选择 ${MAX_UPLOAD_FILES} 张照片`);
      }

      if (errors.length > 0) {
        queueMicrotask(() => setBatchError(errors.join("；")));
      }

      return [...current, ...accepted];
    });
  }

  async function finishUpload(item: LocalUploadItem, upload: InitializedUpload) {
    try {
      updateQueue(item.key, { uploadId: upload.uploadId, status: "uploading", error: undefined });
      await uploadToR2(item.file, upload, (progress) => updateQueue(item.key, { progress }));
      updateQueue(item.key, { status: "processing", progress: 100 });
      const result = await responseJson<{ task: UploadTaskView }>(
        await fetch(`/api/admin/uploads/${upload.uploadId}/complete`, { method: "POST" }),
      );
      updateQueue(item.key, {
        status: "succeeded",
        deduplicated: result.task.deduplicated,
        error: undefined,
      });
    } catch (error) {
      updateQueue(item.key, {
        status: "failed",
        error: error instanceof Error ? error.message : "上传失败。",
      });
    } finally {
      await refreshTasks().catch(() => undefined);
    }
  }

  async function startUploads() {
    const pending = queue.filter((item) => item.status === "queued");

    if (!selectedAlbumId || pending.length === 0) {
      return;
    }

    setStarting(true);
    setBatchError("");

    try {
      const result = await responseJson<{ uploads: InitializedUpload[] }>(
        await fetch("/api/admin/uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            albumId: selectedAlbumId,
            files: pending.map((item) => ({
              name: item.file.name,
              type: item.file.type,
              size: item.file.size,
            })),
          }),
        }),
      );
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(UPLOAD_CONCURRENCY, result.uploads.length) },
        async () => {
          while (cursor < result.uploads.length) {
            const index = cursor;
            cursor += 1;
            await finishUpload(pending[index], result.uploads[index]);
          }
        },
      );
      await Promise.all(workers);
      router.refresh();
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "无法创建上传任务。");
    } finally {
      setStarting(false);
      await refreshTasks().catch(() => undefined);
    }
  }

  async function retryTask(task: UploadTaskView) {
    setRetryingIds((current) => new Set(current).add(task.id));

    try {
      const result = await responseJson<
        | { action: "upload"; upload: InitializedUpload }
        | { action: "processing" | "completed"; task: UploadTaskView }
      >(await fetch(`/api/admin/uploads/${task.id}/retry`, { method: "POST" }));

      if (result.action === "upload") {
        const local = queue.find(
          (item) => item.uploadId === task.id || item.file.name === task.originalFilename,
        );

        if (local) {
          await finishUpload(local, result.upload);
        } else {
          setReuploadUrls((current) => ({ ...current, [task.id]: result.upload }));
          setTasks((current) =>
            current.map((item) =>
              item.id === task.id
                ? { ...item, status: "PENDING", failureMessage: "请重新选择同一原文件继续上传。" }
                : item,
            ),
          );
        }
      } else {
        setTasks((current) =>
          current.map((item) => (item.id === result.task.id ? result.task : item)),
        );
        router.refresh();
      }
    } catch (error) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                failureMessage: error instanceof Error ? error.message : "重试失败。",
              }
            : item,
        ),
      );
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
      await refreshTasks().catch(() => undefined);
    }
  }

  async function continueReupload(task: UploadTaskView, file: File) {
    const upload = reuploadUrls[task.id];

    if (
      !upload ||
      file.name !== task.originalFilename ||
      file.size !== task.expectedByteSize ||
      !isAcceptedUploadFile(file.name, file.type)
    ) {
      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, failureMessage: "所选文件与原上传记录不一致。" } : item,
        ),
      );
      return;
    }

    const local: LocalUploadItem = {
      key: localKey(file),
      file,
      uploadId: task.id,
      status: "queued",
      progress: 0,
    };
    setQueue((current) => [...current, local]);
    await finishUpload(local, upload);
    setReuploadUrls((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });
    router.refresh();
  }

  const queuedCount = queue.filter((item) => item.status === "queued").length;
  const activeQueue = queue.filter((item) => item.status !== "cancelled");
  const overallProgress = useMemo(() => {
    const total = activeQueue.reduce((sum, item) => sum + item.file.size, 0);

    if (total === 0) {
      return 0;
    }

    return Math.round(
      activeQueue.reduce((sum, item) => sum + item.file.size * (item.progress / 100), 0) / total,
    );
  }, [activeQueue]);

  return (
    <div className="admin-upload-manager">
      <section className="admin-panel admin-upload-compose">
        <div className="admin-panel-head">
          <div>
            <span className="label">Direct to R2</span>
            <h2>上传照片</h2>
          </div>
          <span className="admin-upload-limit">单张 ≤ 60MB · 每批 ≤ 20 张 · 并发 2</span>
        </div>

        <label className="admin-field admin-upload-album-field">
          <span>目标相册</span>
          <select
            value={selectedAlbumId}
            onChange={(event) => setSelectedAlbumId(event.target.value)}
          >
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.title}
              </option>
            ))}
          </select>
        </label>

        <div
          className={`admin-upload-dropzone${dragActive ? " admin-upload-dropzone-active" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) {
              setDragActive(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.tif,.tiff"
            onChange={(event) => {
              if (event.target.files) {
                addFiles(event.target.files);
                event.target.value = "";
              }
            }}
          />
          <strong>拖入原图，或选择文件</strong>
          <span>原图直接写入私有 R2，不经过 Next.js 请求体。</span>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={() => inputRef.current?.click()}
          >
            选择照片
          </button>
        </div>

        {batchError ? (
          <p className="admin-form-message admin-form-message-error">{batchError}</p>
        ) : null}

        {activeQueue.length > 0 ? (
          <div className="admin-upload-queue">
            <div className="admin-upload-overall">
              <span>本批总体进度</span>
              <strong>{overallProgress}%</strong>
              <i style={{ width: `${overallProgress}%` }} />
            </div>
            {activeQueue.map((item) => (
              <article key={item.key} className="admin-upload-queue-item">
                <div>
                  <strong>{item.file.name}</strong>
                  <span>{formatUploadByteSize(item.file.size)}</span>
                </div>
                <div className="admin-upload-item-progress">
                  <i style={{ width: `${item.progress}%` }} />
                </div>
                <span
                  className={`admin-upload-local-status admin-upload-local-status-${item.status}`}
                >
                  {item.status === "queued"
                    ? "等待开始"
                    : item.status === "uploading"
                      ? `上传 ${item.progress}%`
                      : item.status === "processing"
                        ? "生成变体中"
                        : item.status === "succeeded"
                          ? item.deduplicated
                            ? "已关联已有照片"
                            : "处理完成"
                          : "失败"}
                </span>
                {item.status === "queued" && !starting ? (
                  <button
                    type="button"
                    onClick={() => updateQueue(item.key, { status: "cancelled" })}
                  >
                    移出
                  </button>
                ) : null}
                {item.error ? <p>{item.error}</p> : null}
              </article>
            ))}
          </div>
        ) : null}

        <div className="admin-upload-actions">
          <button
            type="button"
            className="admin-button admin-button-primary"
            disabled={!selectedAlbumId || queuedCount === 0 || starting}
            onClick={() => void startUploads()}
          >
            {starting ? "正在处理本批照片…" : `开始上传${queuedCount ? `（${queuedCount}）` : ""}`}
          </button>
          {queue.length > 0 && !workInProgress ? (
            <button
              type="button"
              className="admin-button admin-button-secondary"
              onClick={() => setQueue([])}
            >
              清空列表
            </button>
          ) : null}
        </div>
      </section>

      <section className="admin-panel admin-upload-history">
        <div className="admin-panel-head">
          <div>
            <span className="label">Tasks / {String(tasks.length).padStart(2, "0")}</span>
            <h2>最近上传任务</h2>
          </div>
          <button
            type="button"
            className="admin-button admin-button-secondary"
            onClick={() => void refreshTasks()}
          >
            刷新状态
          </button>
        </div>
        {tasks.length > 0 ? (
          <div className="admin-upload-task-list">
            {tasks.map((task) => (
              <article key={task.id} className="admin-upload-task">
                <div className="admin-upload-task-file">
                  <strong>{task.originalFilename}</strong>
                  <span>
                    {task.albumTitle} · {formatUploadByteSize(task.expectedByteSize)}
                  </span>
                </div>
                <span className={taskClass(task.status)}>{STATUS_LABELS[task.status]}</span>
                <span className="admin-upload-task-time">
                  {new Intl.DateTimeFormat("zh-CN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(task.updatedAt))}
                </span>
                <div className="admin-upload-task-result">
                  {task.status === "SUCCEEDED" ? (
                    <span>
                      {task.deduplicated ? "检测到重复，已关联已有照片" : "照片和公开变体已入库"}
                    </span>
                  ) : task.failureMessage ? (
                    <span>{task.failureMessage}</span>
                  ) : (
                    <span>处理尝试 {task.attemptCount}</span>
                  )}
                </div>
                {task.status === "FAILED" || task.status === "PENDING" ? (
                  <div className="admin-upload-task-actions">
                    <button
                      type="button"
                      disabled={retryingIds.has(task.id)}
                      onClick={() => void retryTask(task)}
                    >
                      {retryingIds.has(task.id) ? "重试中…" : "重试"}
                    </button>
                    {reuploadUrls[task.id] ? (
                      <label>
                        选择原文件
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.tif,.tiff"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void continueReupload(task, file);
                            }
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-inline-empty">
            <p>还没有上传任务。</p>
            <span>选择相册和照片后，任务状态会显示在这里。</span>
          </div>
        )}
      </section>
    </div>
  );
}
