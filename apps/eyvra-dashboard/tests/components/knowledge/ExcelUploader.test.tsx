import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExcelUploader } from "@/components/knowledge/ExcelUploader";

function buildFile(name: string): File {
  return new File(["content"], name, { type: "application/vnd.ms-excel" });
}

describe("ExcelUploader", () => {
  it("renders the dropzone with supported formats hint", () => {
    render(<ExcelUploader onFileSelected={vi.fn()} />);
    expect(screen.getByText(/Drop Excel file di sini/)).toBeInTheDocument();
    expect(screen.getByText(/\.xlsx, \.xls/)).toBeInTheDocument();
  });

  it("calls onFileSelected when a valid .xlsx file is chosen via the file input", async () => {
    const onFileSelected = vi.fn();
    render(<ExcelUploader onFileSelected={onFileSelected} />);
    const input = screen.getByLabelText("Pilih file Excel") as HTMLInputElement;
    const file = buildFile("SOP.xlsx");
    await userEvent.upload(input, file);
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("shows an error and does not call onFileSelected for an unsupported file type", async () => {
    const onFileSelected = vi.fn();
    render(<ExcelUploader onFileSelected={onFileSelected} />);
    const input = screen.getByLabelText("Pilih file Excel") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [buildFile("notes.pdf")] } });
    expect(screen.getByText(/harus berformat \.xlsx atau \.xls/)).toBeInTheDocument();
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it("handles drag-and-drop of a valid file", () => {
    const onFileSelected = vi.fn();
    render(<ExcelUploader onFileSelected={onFileSelected} />);
    const dropzone = screen.getByTestId("excel-dropzone");
    const file = buildFile("Promo.xlsx");
    const dataTransfer = { files: [file] } as unknown as DataTransfer;
    dropzone.dispatchEvent(
      Object.assign(new Event("drop", { bubbles: true, cancelable: true }), { dataTransfer }),
    );
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });
});
