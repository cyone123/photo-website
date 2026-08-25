"use client";

import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { useState } from "react";
import {
  clearAlbumChapterAction,
  removeAlbumPhotoAction,
  saveAlbumPhotoOrderAction,
  updateAlbumChapterAction,
  updateAlbumCoverAction,
  updatePhotoAction,
} from "@/app/admin/actions";
import { photoDateFromDatetimeLocal, photoDateTimeInputValue } from "@/lib/photo-date";
import type { AdminAlbumPhoto } from "@/server/admin/admin-gallery";
import type { AdminActionState, AdminMutationState } from "./admin-action-state";

type PhotoDraft = {
  title: string;
  description: string;
  takenAt: string;
};

type ChapterDraft = {
  title: string;
  text: string;
};

type FocalPoint = {
  x: number;
  y: number;
};

function datetimeLocalValue(value: Date | string | null) {
  return photoDateTimeInputValue(value);
}

function dateFromDatetimeLocal(value: string) {
  return photoDateFromDatetimeLocal(value);
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function initialPhotoDrafts(photos: AdminAlbumPhoto[]) {
  return Object.fromEntries(
    photos.map((photo) => [
      photo.id,
      {
        title: photo.title ?? "",
        description: photo.description ?? "",
        takenAt: datetimeLocalValue(photo.takenAt),
      },
    ]),
  ) as Record<string, PhotoDraft>;
}

function initialChapterDrafts(photos: AdminAlbumPhoto[]) {
  return Object.fromEntries(
    photos.map((photo) => [
      photo.id,
      {
        title: photo.chapterTitle ?? "",
        text: photo.chapterText ?? "",
      },
    ]),
  ) as Record<string, ChapterDraft>;
}

function actionFailure(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
}

export function AdminAlbumPhotoEditor({
  albumId,
  initialPhotos,
  initialCoverPhotoId,
  initialCoverFocalX,
  initialCoverFocalY,
}: {
  albumId: string;
  initialPhotos: AdminAlbumPhoto[];
  initialCoverPhotoId: string | null;
  initialCoverFocalX: number;
  initialCoverFocalY: number;
}) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [coverPhotoId, setCoverPhotoId] = useState(initialCoverPhotoId);
  const [focalPoint, setFocalPoint] = useState<FocalPoint>({
    x: initialCoverFocalX,
    y: initialCoverFocalY,
  });
  const [photoDrafts, setPhotoDrafts] = useState(() => initialPhotoDrafts(initialPhotos));
  const [chapterDrafts, setChapterDrafts] = useState(() => initialChapterDrafts(initialPhotos));
  const [expandedInfo, setExpandedInfo] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [orderDirty, setOrderDirty] = useState(false);
  const [focalDragging, setFocalDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<AdminActionState | null>(null);

  const coverPhoto =
    photos.find((photo) => photo.id === coverPhotoId && photo.status === "READY") ?? null;

  async function runAction(
    action: () => Promise<AdminActionState | AdminMutationState>,
    onSuccess?: (result: AdminActionState | AdminMutationState) => void,
  ) {
    setPending(true);
    setNotice(null);

    try {
      const result = await action();
      setNotice(result);

      if (result.status === "success") {
        onSuccess?.(result);
      }
    } catch (error) {
      setNotice({ status: "error", message: actionFailure(error) });
    } finally {
      setPending(false);
    }
  }

  function reorderPhoto(photoId: string, targetPhotoId: string) {
    if (photoId === targetPhotoId) {
      return;
    }

    setPhotos((current) => {
      const fromIndex = current.findIndex((photo) => photo.id === photoId);
      const toIndex = current.findIndex((photo) => photo.id === targetPhotoId);

      if (fromIndex < 0 || toIndex < 0) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setOrderDirty(true);
  }

  function movePhoto(photoId: string, offset: -1 | 1) {
    const index = photos.findIndex((photo) => photo.id === photoId);
    const target = photos[index + offset];

    if (!target) {
      return;
    }

    reorderPhoto(photoId, target.id);
  }

  function handlePhotoKeyDown(event: React.KeyboardEvent<HTMLElement>, photoId: string) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      movePhoto(photoId, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      movePhoto(photoId, 1);
    }
  }

  function saveOrder() {
    void runAction(
      () =>
        saveAlbumPhotoOrderAction(albumId, {
          photoIds: photos.map((photo) => photo.id),
        }),
      () => setOrderDirty(false),
    );
  }

  function selectCover(photo: AdminAlbumPhoto) {
    if (photo.status !== "READY" || photo.id === coverPhotoId) {
      return;
    }

    void runAction(
      () =>
        updateAlbumCoverAction({
          albumId,
          photoId: photo.id,
          coverFocalX: 50,
          coverFocalY: 50,
        }),
      () => {
        setCoverPhotoId(photo.id);
        setFocalPoint({ x: 50, y: 50 });
      },
    );
  }

  function focalFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100),
    };
  }

  function saveFocalPoint(next: FocalPoint) {
    if (!coverPhotoId) {
      return;
    }

    void runAction(() =>
      updateAlbumCoverAction({
        albumId,
        photoId: coverPhotoId,
        coverFocalX: next.x,
        coverFocalY: next.y,
      }),
    );
  }

  function handleFocalPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!coverPhoto) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setFocalDragging(true);
    setFocalPoint(focalFromPointer(event));
  }

  function handleFocalPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!focalDragging) {
      return;
    }

    setFocalPoint(focalFromPointer(event));
  }

  function handleFocalPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!focalDragging) {
      return;
    }

    const next = focalFromPointer(event);
    setFocalDragging(false);
    setFocalPoint(next);
    saveFocalPoint(next);
  }

  function handleFocalKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.shiftKey ? 10 : 5;
    let next = focalPoint;

    if (event.key === "ArrowLeft") {
      next = { ...focalPoint, x: clamp(focalPoint.x - delta) };
    } else if (event.key === "ArrowRight") {
      next = { ...focalPoint, x: clamp(focalPoint.x + delta) };
    } else if (event.key === "ArrowUp") {
      next = { ...focalPoint, y: clamp(focalPoint.y - delta) };
    } else if (event.key === "ArrowDown") {
      next = { ...focalPoint, y: clamp(focalPoint.y + delta) };
    } else {
      return;
    }

    event.preventDefault();
    setFocalPoint(next);
    saveFocalPoint(next);
  }

  function updatePhotoDraft(photoId: string, field: keyof PhotoDraft, value: string) {
    setPhotoDrafts((current) => ({
      ...current,
      [photoId]: { ...current[photoId], [field]: value },
    }));
  }

  function submitPhotoInfo(event: FormEvent<HTMLFormElement>, photo: AdminAlbumPhoto) {
    event.preventDefault();
    const draft = photoDrafts[photo.id];

    void runAction(
      () =>
        updatePhotoAction({
          id: photo.id,
          title: draft.title,
          description: draft.description,
          takenAt: draft.takenAt,
        }),
      () => {
        setPhotos((current) =>
          current.map((currentPhoto) =>
            currentPhoto.id === photo.id
              ? {
                  ...currentPhoto,
                  title: draft.title.trim() || null,
                  description: draft.description.trim() || null,
                  takenAt: dateFromDatetimeLocal(draft.takenAt),
                }
              : currentPhoto,
          ),
        );
      },
    );
  }

  function updateChapterDraft(photoId: string, field: keyof ChapterDraft, value: string) {
    setChapterDrafts((current) => ({
      ...current,
      [photoId]: { ...current[photoId], [field]: value },
    }));
  }

  function submitChapter(event: FormEvent<HTMLFormElement>, photo: AdminAlbumPhoto) {
    event.preventDefault();
    const draft = chapterDrafts[photo.id];

    void runAction(
      () =>
        updateAlbumChapterAction({
          albumId,
          photoId: photo.id,
          title: draft.title,
          text: draft.text,
        }),
      () => {
        setPhotos((current) =>
          current.map((currentPhoto) =>
            currentPhoto.id === photo.id
              ? {
                  ...currentPhoto,
                  chapterTitle: draft.title.trim() || null,
                  chapterText: draft.text.trim() || null,
                }
              : currentPhoto,
          ),
        );
      },
    );
  }

  function clearChapter(photo: AdminAlbumPhoto) {
    void runAction(
      () => clearAlbumChapterAction(albumId, photo.id),
      () => {
        setChapterDrafts((current) => ({
          ...current,
          [photo.id]: { title: "", text: "" },
        }));
        setPhotos((current) =>
          current.map((currentPhoto) =>
            currentPhoto.id === photo.id
              ? { ...currentPhoto, chapterTitle: null, chapterText: null }
              : currentPhoto,
          ),
        );
        setExpandedChapters((current) => ({ ...current, [photo.id]: false }));
      },
    );
  }

  function removePhoto(photo: AdminAlbumPhoto) {
    if (
      !window.confirm(
        `确定从相册移除“${photo.title ?? "未命名照片"}”吗？若没有其他相册引用，还会删除照片数据。`,
      )
    ) {
      return;
    }

    void runAction(
      () => removeAlbumPhotoAction(albumId, photo.id),
      (result) => {
        setPhotos((current) => current.filter((currentPhoto) => currentPhoto.id !== photo.id));
        setOrderDirty(false);

        const nextCoverId = (result as AdminMutationState).coverPhotoId;

        if (nextCoverId !== undefined) {
          if (nextCoverId !== coverPhotoId) {
            setFocalPoint({ x: 50, y: 50 });
          }
          setCoverPhotoId(nextCoverId);
        }
      },
    );
  }

  return (
    <>
      <div className="admin-photo-toolbar">
        <p>拖动照片调整顺序，也可以聚焦卡片后使用 ↑ / ↓ 键或按钮移动。</p>
        <button
          className="admin-button admin-button-primary"
          type="button"
          disabled={!orderDirty || pending}
          onClick={saveOrder}
        >
          {pending && orderDirty ? "正在保存顺序…" : "保存照片顺序"}
        </button>
      </div>

      {coverPhoto ? (
        <section className="admin-cover-editor" aria-labelledby="admin-cover-editor-title">
          <div className="admin-cover-editor-head">
            <div>
              <span className="label">Cover / Focal Point</span>
              <h3 id="admin-cover-editor-title">封面裁切焦点</h3>
              <p>
                点击或拖动预览中的焦点；键盘方向键也可以微调。当前 {focalPoint.x}% / {focalPoint.y}%
              </p>
            </div>
            <span className="admin-photo-status admin-photo-status-ready">封面 · READY</span>
          </div>
          <div className="admin-cover-previews">
            <div>
              <span className="admin-cover-preview-label">桌面裁切</span>
              <div
                className="admin-cover-canvas admin-cover-canvas-desktop"
                role="slider"
                tabIndex={0}
                aria-label="调整桌面封面焦点"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={focalPoint.x}
                style={
                  {
                    backgroundImage: coverPhoto.previewUrl
                      ? `url("${coverPhoto.previewUrl}")`
                      : undefined,
                    backgroundPosition: `${focalPoint.x}% ${focalPoint.y}%`,
                  } as CSSProperties
                }
                onKeyDown={handleFocalKeyDown}
                onPointerDown={handleFocalPointerDown}
                onPointerMove={handleFocalPointerMove}
                onPointerUp={handleFocalPointerUp}
                onPointerCancel={() => setFocalDragging(false)}
              >
                <i style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }} />
              </div>
            </div>
            <div>
              <span className="admin-cover-preview-label">移动裁切</span>
              <div
                className="admin-cover-canvas admin-cover-canvas-mobile"
                aria-hidden="true"
                style={
                  {
                    backgroundImage: coverPhoto.previewUrl
                      ? `url("${coverPhoto.previewUrl}")`
                      : undefined,
                    backgroundPosition: `${focalPoint.x}% ${focalPoint.y}%`,
                  } as CSSProperties
                }
              >
                <i style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }} />
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="admin-inline-empty admin-cover-empty">
          请先选择一张 READY 照片作为封面。
        </div>
      )}

      {notice ? (
        <p
          className={`admin-form-message admin-form-message-${notice.status}`}
          role={notice.status === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      ) : null}

      <div className="admin-photo-grid admin-photo-editor-grid" role="list">
        {photos.map((photo, index) => {
          const infoDraft = photoDrafts[photo.id];
          const chapterDraft = chapterDrafts[photo.id];
          const hasChapter = Boolean(photo.chapterTitle || photo.chapterText);

          return (
            <article
              className={`admin-photo-tile admin-photo-editor-card${draggedPhotoId === photo.id ? " admin-photo-tile-dragging" : ""}`}
              key={photo.id}
              role="listitem"
              tabIndex={0}
              draggable
              aria-label={`第 ${index + 1} 张照片 ${photo.title ?? "未命名照片"}`}
              onKeyDown={(event) => handlePhotoKeyDown(event, photo.id)}
              onDragStart={(event) => {
                if ((event.target as HTMLElement).closest("button,input,textarea")) {
                  event.preventDefault();
                  return;
                }

                setDraggedPhotoId(photo.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", photo.id);
              }}
              onDragEnd={() => setDraggedPhotoId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/plain") || draggedPhotoId;
                if (sourceId) {
                  reorderPhoto(sourceId, photo.id);
                }
                setDraggedPhotoId(null);
              }}
            >
              <div
                className="admin-photo-preview"
                style={
                  photo.previewUrl
                    ? ({
                        backgroundImage: `url("${photo.previewUrl}")`,
                        aspectRatio: `${photo.width} / ${photo.height}`,
                      } as CSSProperties)
                    : ({ aspectRatio: `${photo.width} / ${photo.height}` } as CSSProperties)
                }
              >
                {!photo.previewUrl ? <span>NO PREVIEW</span> : null}
                <i>{String(index + 1).padStart(2, "0")}</i>
                {photo.id === coverPhotoId ? <b>封面</b> : null}
              </div>

              <div className="admin-photo-card-head">
                <div>
                  <strong>{photo.title ?? "未命名照片"}</strong>
                  <span
                    className={`admin-photo-status admin-photo-status-${photo.status.toLowerCase()}`}
                  >
                    {photo.status}
                  </span>
                </div>
                <span className="admin-photo-drag-hint">拖动排序</span>
              </div>

              <div className="admin-photo-card-actions">
                <button
                  className="admin-button admin-button-secondary"
                  type="button"
                  disabled={pending || photo.id === coverPhotoId || photo.status !== "READY"}
                  onClick={() => selectCover(photo)}
                >
                  {photo.id === coverPhotoId ? "当前封面" : "设为封面"}
                </button>
                <button
                  className="admin-button admin-button-secondary"
                  type="button"
                  disabled={pending || index === 0}
                  aria-label="上移照片"
                  onClick={() => movePhoto(photo.id, -1)}
                >
                  ↑
                </button>
                <button
                  className="admin-button admin-button-secondary"
                  type="button"
                  disabled={pending || index === photos.length - 1}
                  aria-label="下移照片"
                  onClick={() => movePhoto(photo.id, 1)}
                >
                  ↓
                </button>
                <button
                  className="admin-button admin-button-danger"
                  type="button"
                  disabled={pending}
                  onClick={() => removePhoto(photo)}
                >
                  移除
                </button>
              </div>

              <div className="admin-photo-editor-links">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedInfo((current) => ({ ...current, [photo.id]: !current[photo.id] }))
                  }
                >
                  {expandedInfo[photo.id] ? "收起照片信息" : "编辑照片信息"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedChapters((current) => ({
                      ...current,
                      [photo.id]: !current[photo.id],
                    }))
                  }
                >
                  {expandedChapters[photo.id]
                    ? "收起章节"
                    : hasChapter
                      ? "编辑章节"
                      : "在此照片前添加章节"}
                </button>
              </div>

              {expandedInfo[photo.id] ? (
                <form
                  className="admin-photo-edit-form"
                  onSubmit={(event) => submitPhotoInfo(event, photo)}
                >
                  <label className="admin-field">
                    <span>照片标题</span>
                    <input
                      value={infoDraft.title}
                      maxLength={240}
                      onChange={(event) => updatePhotoDraft(photo.id, "title", event.target.value)}
                    />
                  </label>
                  <label className="admin-field">
                    <span>照片描述</span>
                    <textarea
                      value={infoDraft.description}
                      rows={3}
                      maxLength={2000}
                      onChange={(event) =>
                        updatePhotoDraft(photo.id, "description", event.target.value)
                      }
                    />
                  </label>
                  <label className="admin-field">
                    <span>拍摄时间</span>
                    <input
                      type="datetime-local"
                      value={infoDraft.takenAt}
                      onChange={(event) =>
                        updatePhotoDraft(photo.id, "takenAt", event.target.value)
                      }
                    />
                    <small>留空会清除拍摄时间。</small>
                  </label>
                  <button
                    className="admin-button admin-button-primary"
                    type="submit"
                    disabled={pending}
                  >
                    保存照片信息
                  </button>
                </form>
              ) : null}

              {expandedChapters[photo.id] ? (
                <form
                  className="admin-photo-edit-form"
                  onSubmit={(event) => submitChapter(event, photo)}
                >
                  <label className="admin-field">
                    <span>章节标题</span>
                    <input
                      value={chapterDraft.title}
                      maxLength={160}
                      onChange={(event) =>
                        updateChapterDraft(photo.id, "title", event.target.value)
                      }
                    />
                  </label>
                  <label className="admin-field">
                    <span>章节正文</span>
                    <textarea
                      value={chapterDraft.text}
                      rows={4}
                      maxLength={4000}
                      onChange={(event) => updateChapterDraft(photo.id, "text", event.target.value)}
                    />
                  </label>
                  <div className="admin-photo-form-actions">
                    <button
                      className="admin-button admin-button-primary"
                      type="submit"
                      disabled={pending}
                    >
                      保存章节
                    </button>
                    <button
                      className="admin-button admin-button-secondary"
                      type="button"
                      disabled={pending || !hasChapter}
                      onClick={() => clearChapter(photo)}
                    >
                      清除章节
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
