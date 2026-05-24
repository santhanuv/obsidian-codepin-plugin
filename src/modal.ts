import { App, ButtonComponent, Modal, TextComponent } from "obsidian";

export class CodepinModal extends Modal {
  private value = "";
  private submitting = false;

  constructor(
    app: App,
    private readonly onSubmit: (url: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("codepin-modal");
    contentEl.createEl("h2", {
      text: "Insert permalink",
    });

    const inputContainer = contentEl.createDiv({
      cls: "codepin-input-container",
    });

    const input = new TextComponent(inputContainer);
    input.setPlaceholder("Paste permalink").onChange((value) => {
      this.value = value;
    });
    input.inputEl.addClass("codepin-input");
    void this.prefillClipboard(input);
    input.inputEl.focus();

    // Safe to leave attached directly since the modal owns the input lifecycle.
    input.inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();

        void this.submit();
      }
    });

    const buttonContainer = contentEl.createDiv({
      cls: "codepin-button-container",
    });

    new ButtonComponent(buttonContainer)
      .setButtonText("Import")
      .setCta()
      .onClick(() => {
        void this.submit();
      });
  }

  private async prefillClipboard(input: TextComponent): Promise<void> {
    try {
      const clipboard = await navigator.clipboard.readText();
      if (!looksLikeUrl(clipboard)) {
        return;
      }

      if (input.inputEl.value === "") {
        this.value = clipboard;
        input.setValue(clipboard);
      }
    } catch {
      // Ignore clipboard access failures.
    }
  }

  private async submit(): Promise<void> {
    const value = this.value.trim();

    if (!value) {
      return;
    }

    if (this.submitting) {
      return;
    }

    try {
      this.submitting = true;
      await this.onSubmit(value);
    } finally {
      this.close();
      this.submitting = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

function looksLikeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
