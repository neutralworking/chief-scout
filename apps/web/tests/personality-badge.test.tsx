/**
 * Tests for PersonalityBadge component.
 *
 * Priority: HIGH — personality badges appear on every player card and detail page.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonalityBadge } from "@/components/PersonalityBadge";

describe("PersonalityBadge", () => {
  describe("null/missing personality", () => {
    it("renders dash in mini mode when no personality", () => {
      const { container } = render(
        <PersonalityBadge personalityType={null} size="mini" />
      );
      expect(container.textContent).toBe("–");
    });

    it("renders 'not yet assessed' in hero mode when no personality", () => {
      render(<PersonalityBadge personalityType={null} size="hero" />);
      expect(
        screen.getByText("Personality not yet assessed.")
      ).toBeInTheDocument();
    });

    it("renders nothing in compact mode when no personality", () => {
      const { container } = render(
        <PersonalityBadge personalityType={null} size="compact" />
      );
      expect(container.innerHTML).toBe("");
    });
  });

  describe("mini mode", () => {
    it("renders the 4-letter code", () => {
      const { container } = render(
        <PersonalityBadge personalityType="ANLC" size="mini" />
      );
      expect(container.textContent).toBe("ANLC");
    });
  });

  describe("compact mode", () => {
    it("renders personality name without 'The' prefix", () => {
      render(<PersonalityBadge personalityType="ANLC" size="compact" />);
      expect(screen.getByText("General")).toBeInTheDocument();
    });

    it("renders personality name for Captain", () => {
      render(<PersonalityBadge personalityType="INLC" size="compact" />);
      expect(screen.getByText("Captain")).toBeInTheDocument();
    });

    it("renders personality name for Maestro", () => {
      render(<PersonalityBadge personalityType="INSP" size="compact" />);
      expect(screen.getByText("Maestro")).toBeInTheDocument();
    });

    it("renders personality name for Showman", () => {
      render(<PersonalityBadge personalityType="AXLC" size="compact" />);
      expect(screen.getByText("Showman")).toBeInTheDocument();
    });

    it("renders personality name for Professor", () => {
      render(<PersonalityBadge personalityType="ANSP" size="compact" />);
      expect(screen.getByText("Professor")).toBeInTheDocument();
    });

    it("renders an SVG icon", () => {
      const { container } = render(
        <PersonalityBadge personalityType="ANLC" size="compact" />
      );
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("falls back to code for unknown personality", () => {
      const { container } = render(
        <PersonalityBadge personalityType="ZZZZ" size="compact" />
      );
      expect(container.textContent).toBe("ZZZZ");
    });
  });

  describe("hero mode", () => {
    it("renders the code prominently", () => {
      render(
        <PersonalityBadge personalityType="INLC" size="hero" />
      );
      expect(screen.getByText("INLC")).toBeInTheDocument();
    });

    it("renders personality name", () => {
      const { container } = render(
        <PersonalityBadge personalityType="INLC" size="hero" />
      );
      expect(container.textContent).toContain("The Captain");
    });

    it("shows dimension bars when scores provided", () => {
      const { container } = render(
        <PersonalityBadge
          personalityType="INLC"
          ei={35}
          sn={40}
          tf={45}
          jp={60}
          size="hero"
        />
      );
      // Should render 4 dimension bars
      expect(container.textContent).toContain("Instinctive");
    });

    it("shows one-liner description", () => {
      const { container } = render(
        <PersonalityBadge personalityType="INLC" size="hero" showDescription />
      );
      expect(container.textContent).toMatch(/vocal leader.*fierce competitor/i);
    });
  });

  describe("dimension score computation", () => {
    it("computes correct code from raw scores", () => {
      // ei=60 (≥50→A), sn=30 (<50→N), tf=70 (≥50→S), jp=20 (<50→P)
      render(
        <PersonalityBadge
          personalityType={null}
          ei={60}
          sn={30}
          tf={70}
          jp={20}
          size="mini"
        />
      );
      // Should compute ANSP = The Professor
      expect(screen.getByText("ANSP")).toBeInTheDocument();
    });

    it("prefers computed code over passed personalityType", () => {
      const { container } = render(
        <PersonalityBadge
          personalityType="XXXX"
          ei={60}
          sn={30}
          tf={70}
          jp={20}
          size="mini"
        />
      );
      expect(container.textContent).toBe("ANSP");
    });
  });

  describe("all 16 types map to names", () => {
    const allTypes = [
      "ANLC", "ANSC", "INSC", "AXLC", "IXSC", "IXLC",
      "INSP", "ANLP", "IXSP", "INLC", "INLP", "AXSC",
      "ANSP", "AXSP", "IXLP", "AXLP",
    ];

    it.each(allTypes)("type %s has a name in compact mode", (code) => {
      const { container } = render(
        <PersonalityBadge personalityType={code} size="compact" />
      );
      // Should not show the raw code (it should show the name)
      const text = container.textContent ?? "";
      // Name should not be the 4-letter code itself
      expect(text).not.toBe(code);
      expect(text.length).toBeGreaterThan(0);
    });
  });
});
