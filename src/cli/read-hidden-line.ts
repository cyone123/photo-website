export function readHiddenLine(prompt: string): Promise<string> {
  const stdin = process.stdin;

  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("密码输入需要交互式终端。");
  }

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    }

    function onData(chunk: Buffer) {
      const input = chunk.toString("utf8");

      for (const character of input) {
        if (character === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("密码输入已取消。"));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        if (character >= " ") {
          value += character;
        }
      }
    }

    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
