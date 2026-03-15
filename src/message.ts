interface MessageOptions {
  packageName: string;
  usedFor?: string;
  customMessage?: string;
}

export function buildMessage(opts: MessageOptions): {
  title: string;
  body: string;
} {
  const { packageName, usedFor, customMessage } = opts;

  const title = `Thanks for building ${packageName}!`;

  if (customMessage) {
    return {
      title,
      body: `${customMessage}\n\n---\n*This message was sent using [give-thanks](https://github.com/jordanfromeverywhere/give-thanks), a CLI for thanking open source maintainers.*`,
    };
  }

  const usedForText = usedFor ? ` for ${usedFor}` : "";

  const body =
    `Hey! I'm using **${packageName}** in my work${usedForText} and wanted to say thanks for building and maintaining this. It makes a real difference.\n\n` +
    `---\n*This message was sent using [give-thanks](https://github.com/jordanfromeverywhere/give-thanks), a CLI for thanking open source maintainers.*`;

  return { title, body };
}
