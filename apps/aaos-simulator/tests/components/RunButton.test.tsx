import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RunButton } from "@/components/simulator/RunButton";

describe("RunButton", () => {
  it("renders the default label with a play glyph", () => {
    render(<RunButton onClick={vi.fn()} />);
    expect(screen.getByTestId("run-button")).toHaveTextContent("▶ Jalankan");
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<RunButton onClick={onClick} />);
    await user.click(screen.getByTestId("run-button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled=true", () => {
    render(<RunButton onClick={vi.fn()} disabled />);
    expect(screen.getByTestId("run-button")).toBeDisabled();
  });

  it('shows "Menjalankan..." and is disabled while isRunning=true', () => {
    render(<RunButton onClick={vi.fn()} isRunning />);
    const button = screen.getByTestId("run-button");
    expect(button).toHaveTextContent("Menjalankan...");
    expect(button).toBeDisabled();
  });
});
