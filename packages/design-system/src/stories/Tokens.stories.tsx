import type { Meta, StoryObj } from "@storybook/react";

const TOKEN_GROUPS = {
  Backgrounds: [
    "bg-primary",
    "bg-secondary",
    "bg-tertiary",
    "bg-elevated",
    "bg-card",
    "bg-system",
    "bg-thinking",
    "bg-code",
  ],
  Text: ["text-primary", "text-secondary", "text-muted", "text-code", "text-inverse"],
  Roles: ["role-user", "role-assistant", "role-tool", "role-subagent", "role-agent"],
  Accent: ["accent", "accent-hover", "accent-subtle", "highlight"],
  Borders: ["border", "border-light"],
  Status: ["error", "success"],
};

function Swatch({ name }: { name: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
      <div
        style={{
          width: 48,
          height: 32,
          background: `var(--${name})`,
          border: "1px solid var(--border)",
        }}
      />
      <code style={{ fontSize: "0.85rem" }}>--{name}</code>
    </div>
  );
}

function TokenPalette() {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 32 }}>
      {Object.entries(TOKEN_GROUPS).map(([group, tokens]) => (
        <div key={group}>
          <h3 style={{ marginBottom: 12, fontSize: "1rem", fontWeight: 600 }}>{group}</h3>
          {tokens.map((t) => (
            <Swatch key={t} name={t} />
          ))}
        </div>
      ))}
    </div>
  );
}

const meta: Meta = {
  title: "Foundations/Tokens",
  component: TokenPalette,
};

export default meta;

type Story = StoryObj;

export const ColorPalette: Story = {};
