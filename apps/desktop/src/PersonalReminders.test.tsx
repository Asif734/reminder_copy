import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PersonalReminders } from "./PersonalReminders";
import { native } from "./native";
import type { ReminderDefinition } from "./types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
vi.mock("./native", () => ({ native: { personal: vi.fn(), savePersonal: vi.fn(), deletePersonal: vi.fn() } }));
const monthly: ReminderDefinition = {
  id: "local:test", title: "Pay rent", description: null, type: "MONTHLY",
  reminder_time: "09:00:00", secondary_reminder_time: null, monthly_due_day: 15,
  days_before: 5, priority: "NORMAL", is_active: true, updated_at: "",
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(native.personal).mockResolvedValue([]);
  vi.mocked(native.savePersonal).mockResolvedValue(undefined);
  vi.mocked(native.deletePersonal).mockResolvedValue(undefined);
});
it("creates monthly reminders through local commands", async () => {
  render(<PersonalReminders />);
  fireEvent.click(screen.getByRole("button", { name: "Add reminder" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Pay rent" } });
  fireEvent.change(screen.getByLabelText("Repeat"), { target: { value: "MONTHLY" } });
  fireEvent.change(screen.getByLabelText("Day of month"), { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
  await waitFor(() => expect(native.savePersonal).toHaveBeenCalledWith(expect.objectContaining({ title: "Pay rent", type: "MONTHLY", monthly_due_day: 15 }), true));
});
it("edits and pauses an existing reminder", async () => {
  vi.mocked(native.personal).mockResolvedValue([monthly]);
  render(<PersonalReminders />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit Pay rent" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New title" } });
  fireEvent.click(screen.getByLabelText("Active"));
  fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
  await waitFor(() => expect(native.savePersonal).toHaveBeenCalledWith(expect.objectContaining({ id: monthly.id, title: "New title", is_active: false }), false));
});
it("deletes only after the user confirms", async () => {
  vi.mocked(native.personal).mockResolvedValue([monthly]);
  render(<PersonalReminders />);
  fireEvent.click(await screen.findByRole("button", { name: "Delete Pay rent" }));
  expect(native.deletePersonal).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete reminder" }));
  await waitFor(() => expect(native.deletePersonal).toHaveBeenCalledWith(monthly.id));
});
it("keeps the form open when saving fails", async () => {
  vi.mocked(native.savePersonal).mockRejectedValue("Storage unavailable");
  render(<PersonalReminders />);
  fireEvent.click(screen.getByRole("button", { name: "Add reminder" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Daily task" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reminder" }));
  await waitFor(() => expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Storage unavailable"));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
