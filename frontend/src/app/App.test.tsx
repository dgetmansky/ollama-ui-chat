import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("renders the one-page diagnostic layout", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Diagnostics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByLabelText("Endpoint")).toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toBeInTheDocument();
  });
});
