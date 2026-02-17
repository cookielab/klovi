/**
 * Demo data generator for Klovi.
 *
 * Run: bun scripts/generate-demo-data.ts
 * Use: bun run dev -- --claude-code-dir ./demo-data/claude-code
 *
 * Creates realistic JSONL session files across 3 projects (7 sessions + 1 sub-agent)
 * showcasing every feature Klovi can render.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dir, "..", "demo-data", "claude-code", "projects");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Emit one JSONL line (a single JSON object terminated by newline). */
function L(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

function writeSession(project: string, sessionId: string, lines: string[]): void {
  const dir = join(OUT, project);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), `${lines.join("\n")}\n`);
}

function writeSubAgent(project: string, sessionId: string, agentId: string, lines: string[]): void {
  const dir = join(OUT, project, sessionId, "subagents");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `agent-${agentId}.jsonl`), `${lines.join("\n")}\n`);
}

/** Incrementing timestamp generator starting from a base ISO string. */
function timestamps(base: string) {
  let ts = new Date(base).getTime();
  return () => {
    ts += 3_000 + Math.floor(Math.random() * 7_000); // 3-10s between lines
    return new Date(ts).toISOString();
  };
}

let _uuid = 0;
function uuid(): string {
  _uuid++;
  const hex = _uuid.toString(16).padStart(8, "0");
  return `${hex}-0000-4000-a000-000000000000`;
}

let _toolId = 0;
function toolId(): string {
  _toolId++;
  return `toolu_demo_${_toolId.toString().padStart(4, "0")}`;
}

// Common base fields
function base(ts: () => string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { uuid: uuid(), timestamp: ts(), ...extra };
}

function userLine(
  ts: () => string,
  content: string | unknown[],
  extra: Record<string, unknown> = {},
): string {
  return L({
    type: "user",
    ...base(ts, extra),
    message: { role: "user", content },
  });
}

function assistantLine(
  ts: () => string,
  model: string,
  content: unknown[],
  stopReason: string,
  usage: Record<string, number>,
  extra: Record<string, unknown> = {},
): string {
  return L({
    type: "assistant",
    ...base(ts, extra),
    message: {
      model,
      role: "assistant",
      content,
      stop_reason: stopReason,
      usage,
    },
  });
}

function systemLine(
  ts: () => string,
  content: string,
  extra: Record<string, unknown> = {},
): string {
  return L({
    type: "system",
    ...base(ts, extra),
    message: { role: "user", content },
  });
}

function toolResult(toolUseId: string, content: string | unknown[], isError = false): unknown {
  return { type: "tool_result", tool_use_id: toolUseId, content, is_error: isError };
}

function progressLine(parentToolUseID: string, agentId: string): string {
  return L({
    type: "progress",
    parentToolUseID,
    data: { type: "agent_progress", agentId, status: "running" },
  });
}

function fileHistorySnapshot(): string {
  return L({
    type: "file-history-snapshot",
    messageId: `msg_${uuid()}`,
    snapshot: {
      trackedFileBackups: {
        "src/server.ts": { backupFileName: "abc123@v1", version: 1 },
        "src/routes.ts": { backupFileName: "def456@v1", version: 1 },
      },
    },
  });
}

function summaryLine(): string {
  return L({
    type: "summary",
    summary:
      "The conversation covered building a REST API with CRUD endpoints, adding input validation, and setting up tests.",
    leafUuid: uuid(),
  });
}

// Thinking, text, and tool_use block helpers
const thinking = (text: string) => ({ type: "thinking", thinking: text });
const text = (t: string) => ({ type: "text", text: t });
const toolUse = (id: string, name: string, input: Record<string, unknown>) => ({
  type: "tool_use",
  id,
  name,
  input,
});

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
const OPUS = "claude-opus-4-6";
const SONNET = "claude-sonnet-4-5-20250929";
const HAIKU = "claude-haiku-4-5-20251001";

// ---------------------------------------------------------------------------
// Project 1: Todo App (-Users-demo-projects-todo-app)
// ---------------------------------------------------------------------------
const TODO_PROJECT = "-Users-demo-projects-todo-app";
const TODO_CWD = "/Users/demo/projects/todo-app";

// --- Session 1: Plan the architecture (PLAN session) ---
function session1_plan(): void {
  const SESSION_ID = "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5";
  const SLUG = "todo-app-architecture";
  const ts = timestamps("2026-02-10T09:00:00Z");
  const common = { slug: SLUG, cwd: TODO_CWD, gitBranch: "main", version: "1.0.45" };

  const t1 = toolId(); // Glob
  const t2 = toolId(); // Read package.json
  const t3 = toolId(); // Read tsconfig
  const t4 = toolId(); // Grep
  const t5 = toolId(); // EnterPlanMode
  const t6 = toolId(); // ExitPlanMode

  const lines = [
    // System prompt
    systemLine(
      ts,
      "You are Claude, an AI assistant created by Anthropic. You help users with software engineering tasks.",
      common,
    ),

    // User asks to plan
    userLine(
      ts,
      "I want to build a todo app with Bun and React. Let's plan the architecture first — I need CRUD endpoints, persistent storage, and a clean component hierarchy.",
      common,
    ),

    // Assistant: thinking + exploration tools
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "The user wants to build a todo app with Bun and React. Let me explore the existing project structure first to understand what we're working with. I should look at the package.json, any existing source files, and the project configuration before proposing an architecture.",
        ),
        text("Let me explore the current project structure to understand what we're working with."),
        toolUse(t1, "Glob", { pattern: "**/*.{ts,tsx,json}", path: TODO_CWD }),
      ],
      "tool_use",
      {
        input_tokens: 2500,
        output_tokens: 180,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 8500,
      },
      common,
    ),

    // Tool result (Glob)
    userLine(ts, [toolResult(t1, "package.json\ntsconfig.json\nsrc/index.ts\nbun.lock")]),

    // Assistant continues: Read files
    assistantLine(
      ts,
      OPUS,
      [
        text("Good, it's a fresh project. Let me check the configuration."),
        toolUse(t2, "Read", { file_path: `${TODO_CWD}/package.json` }),
        toolUse(t3, "Read", { file_path: `${TODO_CWD}/tsconfig.json` }),
      ],
      "tool_use",
      {
        input_tokens: 3200,
        output_tokens: 120,
        cache_read_input_tokens: 8500,
        cache_creation_input_tokens: 0,
      },
    ),

    // Tool results
    userLine(ts, [
      toolResult(
        t2,
        '{\n  "name": "todo-app",\n  "version": "0.1.0",\n  "dependencies": {\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0"\n  },\n  "devDependencies": {\n    "bun-types": "latest",\n    "typescript": "^5.7.0"\n  }\n}',
      ),
      toolResult(
        t3,
        '{\n  "compilerOptions": {\n    "strict": true,\n    "jsx": "react-jsx",\n    "target": "ESNext",\n    "module": "ESNext",\n    "moduleResolution": "bundler"\n  }\n}',
      ),
    ]),

    // Grep for existing patterns
    assistantLine(
      ts,
      OPUS,
      [toolUse(t4, "Grep", { pattern: "Bun\\.serve|createRoot", path: TODO_CWD })],
      "tool_use",
      {
        input_tokens: 3800,
        output_tokens: 60,
        cache_read_input_tokens: 8500,
        cache_creation_input_tokens: 0,
      },
    ),

    // Tool result
    userLine(ts, [
      toolResult(t4, "src/index.ts:3:Bun.serve({ fetch: () => new Response('hello') })"),
    ]),

    // Enter plan mode
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "Good — the project has a minimal Bun.serve() setup and React configured but no real structure yet. I should enter plan mode to design the architecture properly before implementation. The plan should cover:\n\n1. Backend: REST API routes for CRUD operations on todos\n2. Storage: SQLite via bun:sqlite for persistence\n3. Frontend: React component hierarchy with proper state management\n4. Project structure: Clean separation of concerns",
        ),
        text(
          "I have a good picture of the project. Let me enter plan mode to design the architecture.",
        ),
        toolUse(t5, "EnterPlanMode", {}),
      ],
      "tool_use",
      {
        input_tokens: 4200,
        output_tokens: 350,
        cache_read_input_tokens: 8500,
        cache_creation_input_tokens: 0,
      },
    ),

    // Tool result for EnterPlanMode
    userLine(ts, [toolResult(t5, "Plan mode entered")]),

    // isMeta line (should be filtered out)
    L({
      type: "user",
      isMeta: true,
      ...base(ts),
      message: { role: "user", content: "Plan mode acknowledged by system" },
    }),

    // Assistant writes the plan
    assistantLine(
      ts,
      OPUS,
      [
        text(
          `# Todo App Architecture Plan

## Project Structure

\`\`\`
src/
├── server.ts          # Bun.serve() entry point with routes
├── db.ts              # SQLite database setup (bun:sqlite)
├── routes/
│   └── todos.ts       # CRUD handlers for /api/todos
├── frontend/
│   ├── App.tsx         # Root component
│   ├── components/
│   │   ├── TodoList.tsx
│   │   ├── TodoItem.tsx
│   │   └── AddTodoForm.tsx
│   └── hooks/
│       └── useTodos.ts # Data fetching hook
└── index.html          # HTML entry point
\`\`\`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| \`GET\` | \`/api/todos\` | List all todos |
| \`POST\` | \`/api/todos\` | Create a new todo |
| \`PATCH\` | \`/api/todos/:id\` | Update a todo |
| \`DELETE\` | \`/api/todos/:id\` | Delete a todo |

## Storage

Using \`bun:sqlite\` for zero-dependency persistence:

\`\`\`sql
CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## Component Hierarchy

- **\`App\`** — layout, theme provider
  - **\`AddTodoForm\`** — input + submit button
  - **\`TodoList\`** — maps over todos
    - **\`TodoItem\`** — checkbox, title, delete button

## Key Decisions

1. **No ORM** — direct SQLite queries via \`bun:sqlite\` for simplicity
2. **HTML imports** — Bun's built-in bundler for React, no Vite needed
3. **Optimistic updates** — toggle completion instantly, sync in background
4. **Plain CSS** — custom properties for theming, no Tailwind`,
        ),
        toolUse(t6, "ExitPlanMode", {}),
      ],
      "tool_use",
      {
        input_tokens: 5000,
        output_tokens: 1200,
        cache_read_input_tokens: 8500,
        cache_creation_input_tokens: 0,
      },
    ),

    // Tool result for ExitPlanMode
    userLine(ts, [toolResult(t6, "Plan mode exited")]),

    // Final assistant turn
    assistantLine(
      ts,
      OPUS,
      [
        text(
          "The plan covers a clean separation between the Bun backend (REST API + SQLite) and the React frontend. The component hierarchy is minimal but extensible.\n\nWhen you're ready to implement, just say the word and I'll build it step by step.",
        ),
      ],
      "end_turn",
      {
        input_tokens: 5500,
        output_tokens: 200,
        cache_read_input_tokens: 8500,
        cache_creation_input_tokens: 0,
      },
    ),

    // Skipped types (present in file but filtered by parser)
    fileHistorySnapshot(),
    summaryLine(),
  ];

  writeSession(TODO_PROJECT, SESSION_ID, lines);
}

// --- Session 2: Implement the plan (IMPLEMENTATION session, with sub-agent) ---
function session2_implementation(): void {
  const SESSION_ID = "b2c3d4e5-f6a7-4b8c-9d0e-f1a2b3c4d5e6";
  const SLUG = "todo-app-architecture"; // same slug → linked to plan session
  const ts = timestamps("2026-02-10T10:30:00Z");
  const common = { slug: SLUG, cwd: TODO_CWD, gitBranch: "feat/todo-app", version: "1.0.45" };
  const AGENT_ID = "f7e8d9c0";

  const t1 = toolId(); // TaskCreate
  const t2 = toolId(); // TaskCreate
  const t3 = toolId(); // TaskList
  const t4 = toolId(); // Write db.ts
  const t5 = toolId(); // Write routes/todos.ts
  const t6 = toolId(); // Write server.ts
  const t7 = toolId(); // Bash (test)
  const t8 = toolId(); // Task (sub-agent)
  const t9 = toolId(); // TaskUpdate
  const t10 = toolId(); // Write App.tsx
  const t11 = toolId(); // Write TodoList.tsx
  const t12 = toolId(); // Bash (final test)
  const t13 = toolId(); // TaskUpdate

  const lines = [
    // First message starts with "Implement the following plan"
    userLine(
      ts,
      `Implement the following plan:\n\n# Todo App Architecture\n\n## Project Structure\n- src/server.ts — Bun.serve() with routes\n- src/db.ts — SQLite database\n- src/routes/todos.ts — CRUD handlers\n- src/frontend/App.tsx — React root\n- src/frontend/components/ — TodoList, TodoItem, AddTodoForm\n\n## API: GET/POST/PATCH/DELETE /api/todos\n## Storage: bun:sqlite\n## UI: React 19 with plain CSS`,
      common,
    ),

    // Assistant: create tasks, start building
    assistantLine(
      ts,
      SONNET,
      [
        thinking(
          "The user wants me to implement the todo app plan. Let me break this down into tasks:\n1. Set up the database layer (db.ts)\n2. Build the API routes (routes/todos.ts + server.ts)\n3. Create the React frontend components\n4. Wire everything together and test\n\nI'll create tasks to track progress, then start with the backend.",
        ),
        text("I'll implement the plan step by step. Let me create tasks to track progress."),
        toolUse(t1, "TaskCreate", {
          subject: "Set up SQLite database and CRUD routes",
          description:
            "Create db.ts with bun:sqlite schema and routes/todos.ts with GET/POST/PATCH/DELETE handlers",
          activeForm: "Setting up database and routes",
        }),
        toolUse(t2, "TaskCreate", {
          subject: "Build React frontend components",
          description:
            "Create App.tsx, TodoList, TodoItem, and AddTodoForm components with useTodos hook",
          activeForm: "Building React components",
        }),
        toolUse(t3, "TaskList", {}),
      ],
      "tool_use",
      {
        input_tokens: 4500,
        output_tokens: 400,
        cache_read_input_tokens: 12000,
        cache_creation_input_tokens: 0,
      },
      common,
    ),

    // Tool results
    userLine(ts, [
      toolResult(t1, "Task #1 created successfully: Set up SQLite database and CRUD routes"),
      toolResult(t2, "Task #2 created successfully: Build React frontend components"),
      toolResult(
        t3,
        "#1. [pending] Set up SQLite database and CRUD routes\n#2. [pending] Build React frontend components",
      ),
    ]),

    // Assistant: write backend files
    assistantLine(
      ts,
      SONNET,
      [
        toolUse(t4, "Write", {
          file_path: `${TODO_CWD}/src/db.ts`,
          content: `import { Database } from "bun:sqlite";\n\nconst db = new Database("todos.db");\n\ndb.run(\`\n  CREATE TABLE IF NOT EXISTS todos (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    title TEXT NOT NULL,\n    completed BOOLEAN DEFAULT 0,\n    created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n  )\n\`);\n\nexport interface Todo {\n  id: number;\n  title: string;\n  completed: boolean;\n  created_at: string;\n}\n\nexport function getAllTodos(): Todo[] {\n  return db.query("SELECT * FROM todos ORDER BY created_at DESC").all() as Todo[];\n}\n\nexport function createTodo(title: string): Todo {\n  const result = db.run("INSERT INTO todos (title) VALUES (?)", [title]);\n  return db.query("SELECT * FROM todos WHERE id = ?").get(result.lastInsertRowid) as Todo;\n}\n\nexport function updateTodo(id: number, completed: boolean): Todo | null {\n  db.run("UPDATE todos SET completed = ? WHERE id = ?", [completed ? 1 : 0, id]);\n  return db.query("SELECT * FROM todos WHERE id = ?").get(id) as Todo | null;\n}\n\nexport function deleteTodo(id: number): boolean {\n  const result = db.run("DELETE FROM todos WHERE id = ?", [id]);\n  return result.changes > 0;\n}\n`,
        }),
        toolUse(t5, "Write", {
          file_path: `${TODO_CWD}/src/routes/todos.ts`,
          content: `import { getAllTodos, createTodo, updateTodo, deleteTodo } from "../db.ts";\n\nexport const todoRoutes = {\n  "/api/todos": {\n    GET: () => Response.json(getAllTodos()),\n    POST: async (req: Request) => {\n      const { title } = await req.json() as { title: string };\n      if (!title?.trim()) {\n        return Response.json({ error: "Title is required" }, { status: 400 });\n      }\n      return Response.json(createTodo(title), { status: 201 });\n    },\n  },\n  "/api/todos/:id": {\n    PATCH: async (req: Request) => {\n      const id = Number(req.params.id);\n      const { completed } = await req.json() as { completed: boolean };\n      const todo = updateTodo(id, completed);\n      if (!todo) return Response.json({ error: "Not found" }, { status: 404 });\n      return Response.json(todo);\n    },\n    DELETE: (req: Request) => {\n      const id = Number(req.params.id);\n      if (!deleteTodo(id)) return Response.json({ error: "Not found" }, { status: 404 });\n      return new Response(null, { status: 204 });\n    },\n  },\n};\n`,
        }),
        toolUse(t6, "Write", {
          file_path: `${TODO_CWD}/src/server.ts`,
          content: `import index from "./index.html";\nimport { todoRoutes } from "./routes/todos.ts";\n\nBun.serve({\n  port: 3000,\n  routes: {\n    "/": index,\n    ...todoRoutes,\n  },\n  development: {\n    hmr: true,\n    console: true,\n  },\n});\n\nconsole.log("Server running at http://localhost:3000");\n`,
        }),
      ],
      "tool_use",
      {
        input_tokens: 5200,
        output_tokens: 1800,
        cache_read_input_tokens: 12000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Tool results for writes
    userLine(ts, [
      toolResult(t4, `Successfully wrote to ${TODO_CWD}/src/db.ts (42 lines)`),
      toolResult(t5, `Successfully wrote to ${TODO_CWD}/src/routes/todos.ts (32 lines)`),
      toolResult(t6, `Successfully wrote to ${TODO_CWD}/src/server.ts (15 lines)`),
    ]),

    // Run tests
    assistantLine(
      ts,
      SONNET,
      [
        text("Backend is set up. Let me run the tests to verify everything compiles."),
        toolUse(t7, "Bash", {
          command: "cd /Users/demo/projects/todo-app && bun test",
          description: "Run test suite",
        }),
      ],
      "tool_use",
      {
        input_tokens: 5800,
        output_tokens: 120,
        cache_read_input_tokens: 12000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Test results
    userLine(ts, [
      toolResult(
        t7,
        "bun test v1.2.4\n\ndb.test.ts:\n✓ creates a todo [2ms]\n✓ lists all todos [1ms]\n✓ updates a todo [1ms]\n✓ deletes a todo [1ms]\n\n 4 pass\n 0 fail\n Ran 4 tests in 52ms",
      ),
    ]),

    // Launch sub-agent to explore frontend patterns
    assistantLine(
      ts,
      SONNET,
      [
        text(
          "Backend tests pass. Now let me analyze the frontend setup before building the components.",
        ),
        toolUse(t8, "Task", {
          description: "Analyze React frontend patterns",
          prompt:
            "Explore the project at /Users/demo/projects/todo-app and analyze the existing React setup. Check index.html, any existing components, and recommend the best approach for the TodoList component hierarchy. Return a list of key files to review.",
          subagent_type: "Explore",
        }),
      ],
      "tool_use",
      {
        input_tokens: 6200,
        output_tokens: 200,
        cache_read_input_tokens: 12000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Progress event for sub-agent (filtered by parser but used for agentId extraction)
    progressLine(t8, AGENT_ID),

    // Tool result with agentId pattern
    userLine(ts, [
      toolResult(
        t8,
        `Analysis complete. The project uses Bun's HTML imports for bundling — no Vite needed. The index.html should import a frontend.tsx entry point that bootstraps React.\n\nKey findings:\n- React 19 with jsx-runtime configured\n- No existing component files\n- HTML import pattern expected: <script type="module" src="./frontend.tsx">\n\nRecommended approach:\n1. Create index.html with script import\n2. Create frontend.tsx as React entry point\n3. Build components: App → TodoList → TodoItem, AddTodoForm\n4. Use a custom useTodos() hook for data fetching\n\nagentId: ${AGENT_ID}`,
      ),
    ]),

    // Update task, build frontend
    assistantLine(
      ts,
      SONNET,
      [
        toolUse(t9, "TaskUpdate", { taskId: "1", status: "completed" }),
        text("Backend is done. Now building the React frontend."),
        toolUse(t10, "Write", {
          file_path: `${TODO_CWD}/src/frontend/App.tsx`,
          content: `import React, { useState, useEffect } from "react";\nimport "./App.css";\n\ninterface Todo {\n  id: number;\n  title: string;\n  completed: boolean;\n}\n\nexport default function App() {\n  const [todos, setTodos] = useState<Todo[]>([]);\n  const [newTitle, setNewTitle] = useState("");\n\n  useEffect(() => {\n    fetch("/api/todos").then(r => r.json()).then(setTodos);\n  }, []);\n\n  const addTodo = async () => {\n    if (!newTitle.trim()) return;\n    const res = await fetch("/api/todos", {\n      method: "POST",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({ title: newTitle }),\n    });\n    const todo = await res.json();\n    setTodos(prev => [todo, ...prev]);\n    setNewTitle("");\n  };\n\n  const toggleTodo = async (id: number, completed: boolean) => {\n    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed } : t));\n    await fetch(\`/api/todos/\${id}\`, {\n      method: "PATCH",\n      headers: { "Content-Type": "application/json" },\n      body: JSON.stringify({ completed }),\n    });\n  };\n\n  const deleteTodo = async (id: number) => {\n    setTodos(prev => prev.filter(t => t.id !== id));\n    await fetch(\`/api/todos/\${id}\`, { method: "DELETE" });\n  };\n\n  return (\n    <div className="app">\n      <h1>Todo App</h1>\n      <form onSubmit={e => { e.preventDefault(); addTodo(); }}>\n        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What needs to be done?" />\n        <button type="submit">Add</button>\n      </form>\n      <ul>\n        {todos.map(todo => (\n          <li key={todo.id} className={todo.completed ? "completed" : ""}>\n            <input type="checkbox" checked={todo.completed} onChange={e => toggleTodo(todo.id, e.target.checked)} />\n            <span>{todo.title}</span>\n            <button onClick={() => deleteTodo(todo.id)}>×</button>\n          </li>\n        ))}\n      </ul>\n    </div>\n  );\n}\n`,
        }),
        toolUse(t11, "Write", {
          file_path: `${TODO_CWD}/src/index.html`,
          content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Todo App</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="./frontend/entry.tsx"></script>\n</body>\n</html>\n`,
        }),
      ],
      "tool_use",
      {
        input_tokens: 7000,
        output_tokens: 2200,
        cache_read_input_tokens: 12000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Tool results
    userLine(ts, [
      toolResult(t9, "Updated task #1 status"),
      toolResult(t10, `Successfully wrote to ${TODO_CWD}/src/frontend/App.tsx (58 lines)`),
      toolResult(t11, `Successfully wrote to ${TODO_CWD}/src/index.html (13 lines)`),
    ]),

    // Final test + task update
    assistantLine(
      ts,
      SONNET,
      [
        toolUse(t12, "Bash", {
          command: "cd /Users/demo/projects/todo-app && bun test",
          description: "Run full test suite",
        }),
      ],
      "tool_use",
      {
        input_tokens: 7800,
        output_tokens: 80,
        cache_read_input_tokens: 12000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t12,
        "bun test v1.2.4\n\ndb.test.ts:\n✓ creates a todo [2ms]\n✓ lists all todos [1ms]\n✓ updates a todo [1ms]\n✓ deletes a todo [1ms]\n\nApp.test.tsx:\n✓ renders todo list [15ms]\n✓ adds a new todo [8ms]\n✓ toggles todo completion [5ms]\n✓ deletes a todo [4ms]\n\n 8 pass\n 0 fail\n Ran 8 tests in 124ms",
      ),
    ]),

    assistantLine(
      ts,
      SONNET,
      [
        toolUse(t13, "TaskUpdate", { taskId: "2", status: "completed" }),
        text(
          "All done! The todo app is fully implemented:\n\n**Backend:**\n- `src/db.ts` — SQLite database with CRUD operations\n- `src/routes/todos.ts` — REST API endpoints\n- `src/server.ts` — Bun.serve() entry point\n\n**Frontend:**\n- `src/frontend/App.tsx` — React app with optimistic updates\n- `src/index.html` — HTML entry point with script import\n\nAll 8 tests pass. Run `bun src/server.ts` to start the app at http://localhost:3000.",
        ),
      ],
      "end_turn",
      {
        input_tokens: 8200,
        output_tokens: 350,
        cache_read_input_tokens: 12000,
        cache_creation_input_tokens: 0,
      },
    ),
  ];

  writeSession(TODO_PROJECT, SESSION_ID, lines);

  // Sub-agent session file
  const agentTs = timestamps("2026-02-10T10:45:00Z");
  const at1 = toolId(); // Read
  const at2 = toolId(); // Glob

  const agentLines = [
    systemLine(
      agentTs,
      "You are a code exploration agent. Analyze the project structure and patterns.",
    ),
    userLine(
      agentTs,
      "Explore the project at /Users/demo/projects/todo-app and analyze the existing React setup. Check index.html, any existing components, and recommend the best approach for the TodoList component hierarchy. Return a list of key files to review.",
    ),
    assistantLine(
      agentTs,
      SONNET,
      [
        thinking("Let me explore this project to understand the React setup and what files exist."),
        toolUse(at1, "Read", { file_path: `${TODO_CWD}/package.json` }),
        toolUse(at2, "Glob", { pattern: "src/**/*.{tsx,jsx,html}", path: TODO_CWD }),
      ],
      "tool_use",
      {
        input_tokens: 1200,
        output_tokens: 100,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 3000,
      },
    ),
    userLine(agentTs, [
      toolResult(
        at1,
        '{\n  "name": "todo-app",\n  "version": "0.1.0",\n  "dependencies": {\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0"\n  }\n}',
      ),
      toolResult(at2, "src/index.ts"),
    ]),
    assistantLine(
      agentTs,
      SONNET,
      [
        text(
          'The project uses React 19 with Bun\'s built-in bundler. There are no existing components — just a minimal `src/index.ts`. The recommended approach:\n\n1. Create `index.html` with `<script type="module" src="./frontend.tsx">`\n2. Build component hierarchy: `App` → `TodoList` → `TodoItem`\n3. Use a custom `useTodos()` hook for fetch + state management\n\nKey files to review:\n- `package.json` — dependencies\n- `tsconfig.json` — TypeScript config\n- `src/index.ts` — current entry point',
        ),
      ],
      "end_turn",
      {
        input_tokens: 1800,
        output_tokens: 250,
        cache_read_input_tokens: 3000,
        cache_creation_input_tokens: 0,
      },
    ),
  ];

  writeSubAgent(TODO_PROJECT, SESSION_ID, AGENT_ID, agentLines);
}

// --- Session 3: Fix auth bug (bugfix session) ---
function session3_bugfix(): void {
  const SESSION_ID = "c3d4e5f6-a7b8-4c9d-0e1f-a2b3c4d5e6f7";
  const SLUG = "todo-bugfix-auth";
  const ts = timestamps("2026-02-12T14:00:00Z");
  const common = { slug: SLUG, cwd: TODO_CWD, gitBranch: "fix/auth-crash", version: "1.0.47" };

  const t1 = toolId(); // Grep
  const t2 = toolId(); // Read
  const t3 = toolId(); // Edit
  const t4 = toolId(); // Bash (test - FAILS)
  const t5 = toolId(); // Edit (fix)
  const t6 = toolId(); // Bash (test - passes)
  const t7 = toolId(); // Bash (git status)
  const t8 = toolId(); // Bash (git add + commit)

  const lines = [
    // User reports a bug
    userLine(
      ts,
      "The login form crashes when I submit an empty email. The browser console shows `TypeError: Cannot read properties of undefined (reading 'toLowerCase')`. Can you fix it?",
      common,
    ),

    // Assistant investigates
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "The error suggests that `email` is undefined when `.toLowerCase()` is called on it. This is likely a missing null check in the authentication handler or form validation. Let me search for where `toLowerCase` is used in the auth-related code.",
        ),
        text("Let me find where this error originates."),
        toolUse(t1, "Grep", { pattern: "toLowerCase", path: TODO_CWD }),
      ],
      "tool_use",
      {
        input_tokens: 3000,
        output_tokens: 150,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
      common,
    ),

    // Tool result
    userLine(ts, [
      toolResult(
        t1,
        "src/auth/validate.ts:12:  const normalizedEmail = email.toLowerCase();\nsrc/auth/login.ts:8:  const email = formData.get('email').toLowerCase();",
      ),
    ]),

    // Read the file
    assistantLine(
      ts,
      OPUS,
      [
        text(
          "Found it in two files. Let me read the validation module — that's likely the root cause.",
        ),
        toolUse(t2, "Read", { file_path: `${TODO_CWD}/src/auth/validate.ts` }),
      ],
      "tool_use",
      {
        input_tokens: 3500,
        output_tokens: 100,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t2,
        `     1\t| import { z } from "zod";\n     2\t|\n     3\t| const emailSchema = z.string().email();\n     4\t|\n     5\t| export interface ValidationResult {\n     6\t|   valid: boolean;\n     7\t|   error?: string;\n     8\t| }\n     9\t|\n    10\t| export function validateEmail(email: string): ValidationResult {\n    11\t|   // BUG: no null/undefined check before calling toLowerCase\n    12\t|   const normalizedEmail = email.toLowerCase();\n    13\t|   const result = emailSchema.safeParse(normalizedEmail);\n    14\t|   if (!result.success) {\n    15\t|     return { valid: false, error: "Invalid email address" };\n    16\t|   }\n    17\t|   return { valid: true };\n    18\t| }\n`,
      ),
    ]),

    // Fix the bug
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "The bug is clear: `validateEmail()` receives `email` from form data which can be `null` or `undefined` when the form field is empty. The function's TypeScript type says `string` but at runtime it receives `undefined` from `formData.get('email')`. I need to add a guard at the top of the function.",
        ),
        text(
          "Found the bug at `src/auth/validate.ts:12`. The `email` parameter can be `undefined` at runtime when the form field is empty, but there's no guard before calling `.toLowerCase()`. Let me fix it.",
        ),
        toolUse(t3, "Edit", {
          file_path: `${TODO_CWD}/src/auth/validate.ts`,
          old_string: `export function validateEmail(email: string): ValidationResult {\n  // BUG: no null/undefined check before calling toLowerCase\n  const normalizedEmail = email.toLowerCase();`,
          new_string: `export function validateEmail(email: string | undefined | null): ValidationResult {\n  if (!email || !email.trim()) {\n    return { valid: false, error: "Email is required" };\n  }\n  const normalizedEmail = email.toLowerCase();`,
        }),
      ],
      "tool_use",
      {
        input_tokens: 4000,
        output_tokens: 300,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t3, "Successfully edited src/auth/validate.ts")]),

    // Run tests - they FAIL
    assistantLine(
      ts,
      OPUS,
      [
        text("Let me verify the fix with the test suite."),
        toolUse(t4, "Bash", {
          command: "cd /Users/demo/projects/todo-app && bun test src/auth/",
          description: "Run auth tests",
        }),
      ],
      "tool_use",
      {
        input_tokens: 4500,
        output_tokens: 80,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Test FAILS (error result!)
    userLine(ts, [
      toolResult(
        t4,
        "bun test v1.2.4\n\nvalidate.test.ts:\n✓ validates correct email [1ms]\n✓ rejects invalid email [1ms]\n✓ handles empty email [1ms]\n✗ handles null email [2ms]\n  TypeError: Expected string, received object\n    at validateEmail (src/auth/validate.ts:11:35)\n    at validate.test.ts:22:18\n\nlogin.test.ts:\n✓ logs in with valid credentials [5ms]\n✗ handles missing email [3ms]\n  AssertionError: expected { valid: false, error: 'Email is required' }\n  to deep equal { valid: false, error: 'Please enter your email' }\n\n 3 pass\n 2 fail\n Ran 5 tests in 89ms",
        true, // is_error!
      ),
    ]),

    // Fix the test expectation
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "Two test failures:\n1. The null email test expects a specific error message — I need to match 'Please enter your email' instead of 'Email is required'\n2. The login test has the same expectation mismatch\n\nI should update my error message to match the expected string, since the test reflects the desired UX copy.",
        ),
        text(
          "The tests expect a different error message. Let me update my fix to use the expected copy.",
        ),
        toolUse(t5, "Edit", {
          file_path: `${TODO_CWD}/src/auth/validate.ts`,
          old_string: `return { valid: false, error: "Email is required" };`,
          new_string: `return { valid: false, error: "Please enter your email" };`,
        }),
      ],
      "tool_use",
      {
        input_tokens: 5000,
        output_tokens: 200,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t5, "Successfully edited src/auth/validate.ts")]),

    // Tests pass now
    assistantLine(
      ts,
      OPUS,
      [
        toolUse(t6, "Bash", {
          command: "cd /Users/demo/projects/todo-app && bun test src/auth/",
          description: "Run auth tests again",
        }),
      ],
      "tool_use",
      {
        input_tokens: 5500,
        output_tokens: 60,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t6,
        "bun test v1.2.4\n\nvalidate.test.ts:\n✓ validates correct email [1ms]\n✓ rejects invalid email [1ms]\n✓ handles empty email [1ms]\n✓ handles null email [1ms]\n\nlogin.test.ts:\n✓ logs in with valid credentials [5ms]\n✓ handles missing email [2ms]\n\n 6 pass\n 0 fail\n Ran 6 tests in 78ms",
      ),
    ]),

    // Final assistant response
    assistantLine(
      ts,
      OPUS,
      [
        text(
          "All 6 tests pass. Here's what I fixed:\n\n**Root cause:** `validateEmail()` in `src/auth/validate.ts` called `.toLowerCase()` on the `email` parameter without checking for `null`/`undefined`. When the form is submitted with an empty email field, `formData.get('email')` returns `null`.\n\n**Fix:** Added a guard clause at the top of `validateEmail()` that checks for falsy/empty values before processing, and updated the parameter type to accept `null | undefined`.",
        ),
      ],
      "end_turn",
      {
        input_tokens: 6000,
        output_tokens: 280,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),

    // User asks to commit (slash command)
    userLine(
      ts,
      `<command-message>commit</command-message>\n<command-name>/commit</command-name>\n<command-args>fix: handle empty email in login form validation</command-args>`,
      common,
    ),

    // Assistant: git operations
    assistantLine(
      ts,
      OPUS,
      [
        text("I'll commit the fix."),
        toolUse(t7, "Bash", {
          command: "cd /Users/demo/projects/todo-app && git status",
          description: "Check git status",
        }),
      ],
      "tool_use",
      {
        input_tokens: 6500,
        output_tokens: 80,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t7,
        "On branch fix/auth-crash\nChanges not staged for commit:\n  modified:   src/auth/validate.ts\n\nno changes added to commit",
      ),
    ]),

    assistantLine(
      ts,
      OPUS,
      [
        toolUse(t8, "Bash", {
          command: `cd /Users/demo/projects/todo-app && git add src/auth/validate.ts && git commit -m "$(cat <<'EOF'\nfix: handle empty email in login form validation\n\nAdd null/undefined guard in validateEmail() to prevent TypeError\nwhen form is submitted with empty email field.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\nEOF\n)"`,
          description: "Stage and commit the fix",
        }),
      ],
      "tool_use",
      {
        input_tokens: 7000,
        output_tokens: 150,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t8,
        "[fix/auth-crash 3a7f2c1] fix: handle empty email in login form validation\n 1 file changed, 4 insertions(+), 2 deletions(-)",
      ),
    ]),

    assistantLine(
      ts,
      OPUS,
      [text("Committed the fix on branch `fix/auth-crash` as `3a7f2c1`.")],
      "end_turn",
      {
        input_tokens: 7500,
        output_tokens: 60,
        cache_read_input_tokens: 9000,
        cache_creation_input_tokens: 0,
      },
    ),
  ];

  writeSession(TODO_PROJECT, SESSION_ID, lines);
}

// ---------------------------------------------------------------------------
// Project 2: React Dashboard (-Users-demo-projects-react-dashboard)
// ---------------------------------------------------------------------------
const DASHBOARD_PROJECT = "-Users-demo-projects-react-dashboard";
const DASHBOARD_CWD = "/Users/demo/projects/react-dashboard";

// --- Session 4: Add chart component (with MCP tools, images, WebSearch) ---
function session4_charts(): void {
  const SESSION_ID = "d4e5f6a7-b8c9-4d0e-1f2a-b3c4d5e6f7a8";
  const SLUG = "dashboard-charts";
  const ts = timestamps("2026-02-13T09:00:00Z");
  const common = { slug: SLUG, cwd: DASHBOARD_CWD, gitBranch: "feat/charts", version: "1.0.47" };

  const t1 = toolId(); // WebSearch
  const t2 = toolId(); // WebFetch
  const t3 = toolId(); // AskUserQuestion
  const t4 = toolId(); // Write BarChart.tsx
  const t5 = toolId(); // Write styles
  const t6 = toolId(); // Bash (bun add recharts)
  const t7 = toolId(); // mcp__chrome-devtools__navigate_page
  const t8 = toolId(); // mcp__chrome-devtools__take_screenshot
  const t9 = toolId(); // Edit

  // Tiny 1x1 red PNG for demo image (base64)
  const TINY_PNG =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  const lines = [
    // User with image attachment
    userLine(
      ts,
      [
        {
          type: "text",
          text: "Add a bar chart component to the dashboard. Here's a mockup of what I want:",
        },
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: TINY_PNG },
        },
      ],
      common,
    ),

    // Assistant researches
    assistantLine(
      ts,
      SONNET,
      [
        thinking(
          "The user wants a bar chart component. They've attached a mockup image showing the desired design. I should research the best React charting library for this use case. Let me check what's popular and well-maintained in 2026.",
        ),
        text("Nice mockup! Let me research the best charting library for this."),
        toolUse(t1, "WebSearch", { query: "best React chart library 2026 lightweight bar chart" }),
      ],
      "tool_use",
      {
        input_tokens: 4000,
        output_tokens: 150,
        cache_read_input_tokens: 8000,
        cache_creation_input_tokens: 0,
      },
      common,
    ),

    userLine(ts, [
      toolResult(
        t1,
        "Search results:\n1. Recharts - Most popular React charting library (3.2M weekly downloads)\n2. Nivo - React data visualization components\n3. Victory - Composable React charting\n4. Tremor - React dashboard components with built-in charts",
      ),
    ]),

    // Fetch docs
    assistantLine(
      ts,
      SONNET,
      [
        toolUse(t2, "WebFetch", {
          url: "https://recharts.org/en-US/api/BarChart",
          prompt: "How to create a basic bar chart with Recharts",
        }),
      ],
      "tool_use",
      {
        input_tokens: 4500,
        output_tokens: 80,
        cache_read_input_tokens: 8000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t2,
        'Recharts BarChart API:\n\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from \'recharts\';\n\n<BarChart width={600} height={300} data={data}>\n  <CartesianGrid strokeDasharray="3 3" />\n  <XAxis dataKey="name" />\n  <YAxis />\n  <Tooltip />\n  <Bar dataKey="value" fill="#8884d8" />\n</BarChart>\n\nProps: width, height, data (array of objects), margin, barGap, barCategoryGap',
      ),
    ]),

    // Ask user which library
    assistantLine(
      ts,
      SONNET,
      [
        text("I found several good options. Let me check which you'd prefer."),
        toolUse(t3, "AskUserQuestion", {
          questions: [
            {
              question: "Which charting library should we use?",
              header: "Library",
              options: [
                {
                  label: "Recharts (Recommended)",
                  description: "Most popular, great React integration, 3.2M weekly downloads",
                },
                { label: "Tremor", description: "Full dashboard components, slightly heavier" },
                { label: "Nivo", description: "Beautiful defaults, more complex API" },
              ],
              multiSelect: false,
            },
          ],
        }),
      ],
      "tool_use",
      {
        input_tokens: 5000,
        output_tokens: 200,
        cache_read_input_tokens: 8000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t3, "Recharts (Recommended)")]),

    // User confirms
    userLine(ts, "Go with Recharts, it's what we've used before.", common),

    // Build the component
    assistantLine(
      ts,
      SONNET,
      [
        text("Building the bar chart component with Recharts."),
        toolUse(t4, "Write", {
          file_path: `${DASHBOARD_CWD}/src/components/BarChart.tsx`,
          content: `import React from "react";\nimport {\n  BarChart as RechartsBarChart,\n  Bar,\n  XAxis,\n  YAxis,\n  CartesianGrid,\n  Tooltip,\n  Legend,\n  ResponsiveContainer,\n} from "recharts";\n\ninterface DataPoint {\n  name: string;\n  value: number;\n  previous?: number;\n}\n\ninterface BarChartProps {\n  data: DataPoint[];\n  title?: string;\n  color?: string;\n  showComparison?: boolean;\n}\n\nexport function BarChart({ data, title, color = "#6366f1", showComparison = false }: BarChartProps) {\n  return (\n    <div className="chart-container">\n      {title && <h3 className="chart-title">{title}</h3>}\n      <ResponsiveContainer width="100%" height={300}>\n        <RechartsBarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>\n          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />\n          <XAxis dataKey="name" stroke="var(--text-secondary)" />\n          <YAxis stroke="var(--text-secondary)" />\n          <Tooltip\n            contentStyle={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)" }}\n          />\n          <Legend />\n          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} name="Current" />\n          {showComparison && (\n            <Bar dataKey="previous" fill="var(--text-muted)" radius={[4, 4, 0, 0]} name="Previous" />\n          )}\n        </RechartsBarChart>\n      </ResponsiveContainer>\n    </div>\n  );\n}\n`,
        }),
        toolUse(t5, "Write", {
          file_path: `${DASHBOARD_CWD}/src/components/BarChart.css`,
          content: `.chart-container {\n  background: var(--bg-secondary);\n  border: 1px solid var(--border-color);\n  border-radius: 8px;\n  padding: 16px;\n  margin: 16px 0;\n}\n\n.chart-title {\n  margin: 0 0 12px;\n  font-size: 14px;\n  font-weight: 600;\n  color: var(--text-primary);\n}\n`,
        }),
        toolUse(t6, "Bash", {
          command: "cd /Users/demo/projects/react-dashboard && bun add recharts",
          description: "Install recharts",
        }),
      ],
      "tool_use",
      {
        input_tokens: 5500,
        output_tokens: 1500,
        cache_read_input_tokens: 8000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t4,
        `Successfully wrote to ${DASHBOARD_CWD}/src/components/BarChart.tsx (46 lines)`,
      ),
      toolResult(
        t5,
        `Successfully wrote to ${DASHBOARD_CWD}/src/components/BarChart.css (15 lines)`,
      ),
      toolResult(t6, "bun add v1.2.4\n\ninstalled recharts@2.15.0\n\n1 package installed [820ms]"),
    ]),

    // MCP tools to verify in browser
    assistantLine(
      ts,
      SONNET,
      [
        text(
          "Component is built and recharts is installed. Let me verify it renders correctly in the browser.",
        ),
        toolUse(t7, "mcp__chrome-devtools__navigate_page", {
          page_id: "page-1",
          url: "http://localhost:3000/dashboard",
        }),
      ],
      "tool_use",
      {
        input_tokens: 6000,
        output_tokens: 100,
        cache_read_input_tokens: 8000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t7, "Navigated to http://localhost:3000/dashboard")]),

    assistantLine(
      ts,
      SONNET,
      [toolUse(t8, "mcp__chrome-devtools__take_screenshot", { page_id: "page-1" })],
      "tool_use",
      {
        input_tokens: 6500,
        output_tokens: 60,
        cache_read_input_tokens: 8000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Tool result with IMAGE
    userLine(ts, [
      toolResult(t8, [
        { type: "text", text: "Screenshot captured at 1920x1080" },
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: TINY_PNG },
        },
      ]),
    ]),

    // Minor fix based on screenshot
    assistantLine(
      ts,
      SONNET,
      [
        text(
          "The chart renders correctly! I can see the bar chart with the sample data. One thing — the chart title needs a bit more spacing from the container edge. Let me adjust.",
        ),
        toolUse(t9, "Edit", {
          file_path: `${DASHBOARD_CWD}/src/components/BarChart.css`,
          old_string: "padding: 16px;",
          new_string: "padding: 20px 24px;",
        }),
      ],
      "tool_use",
      {
        input_tokens: 7000,
        output_tokens: 150,
        cache_read_input_tokens: 8000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t9, "Successfully edited src/components/BarChart.css")]),

    assistantLine(
      ts,
      SONNET,
      [
        text(
          'The `BarChart` component is ready! It supports:\n\n- **Responsive sizing** via `ResponsiveContainer`\n- **Theme-aware styling** using CSS custom properties\n- **Optional comparison mode** (`showComparison` prop) for before/after data\n- **Customizable colors** via the `color` prop\n\nUsage:\n```tsx\nimport { BarChart } from "./components/BarChart";\n\nconst data = [\n  { name: "Jan", value: 400, previous: 300 },\n  { name: "Feb", value: 300, previous: 450 },\n  { name: "Mar", value: 600, previous: 500 },\n];\n\n<BarChart data={data} title="Monthly Revenue" showComparison />\n```',
        ),
      ],
      "end_turn",
      {
        input_tokens: 7500,
        output_tokens: 400,
        cache_read_input_tokens: 8000,
        cache_creation_input_tokens: 0,
      },
    ),
  ];

  writeSession(DASHBOARD_PROJECT, SESSION_ID, lines);
}

// --- Session 5: Fix broken tests (with slash command, error results) ---
function session5_tests(): void {
  const SESSION_ID = "e5f6a7b8-c9d0-4e1f-2a3b-c4d5e6f7a8b9";
  const SLUG = "dashboard-fix-tests";
  const ts = timestamps("2026-02-14T11:00:00Z");
  const common = { slug: SLUG, cwd: DASHBOARD_CWD, gitBranch: "fix/tests", version: "1.0.48" };

  const t1 = toolId(); // Bash (run tests - fails)
  const t2 = toolId(); // Grep
  const t3 = toolId(); // Read
  const t4 = toolId(); // Edit
  const t5 = toolId(); // Edit
  const t6 = toolId(); // Bash (tests pass)
  const t7 = toolId(); // Bash (git add + commit)

  const lines = [
    // User reports failing tests
    userLine(
      ts,
      "Tests are failing after the latest merge from main. Can you investigate and fix?",
      common,
    ),

    // Run tests first
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "The user says tests are failing after a merge. Let me run the test suite first to see what's broken, then investigate the specific failures.",
        ),
        text("Let me run the tests to see what's failing."),
        toolUse(t1, "Bash", {
          command: "cd /Users/demo/projects/react-dashboard && bun test",
          description: "Run test suite",
        }),
      ],
      "tool_use",
      {
        input_tokens: 3000,
        output_tokens: 120,
        cache_read_input_tokens: 10000,
        cache_creation_input_tokens: 0,
      },
      common,
    ),

    userLine(ts, [
      toolResult(
        t1,
        `bun test v1.2.4

Dashboard.test.tsx:
✓ renders dashboard header [8ms]
✓ displays project list [12ms]
✗ shows correct session count [5ms]
  AssertionError: expected 3 to be 5
    at Dashboard.test.tsx:42:28

BarChart.test.tsx:
✓ renders chart with data [15ms]
✓ handles empty data [3ms]

Sidebar.test.tsx:
✓ renders navigation links [4ms]
✗ highlights active route [6ms]
  Error: Unable to find element with text: /Dashboard/
    at Sidebar.test.tsx:28:45
✗ collapses on mobile [8ms]
  Error: Unable to find element with role "button" and name "Toggle sidebar"
    at Sidebar.test.tsx:35:22

 5 pass
 3 fail
 Ran 8 tests in 215ms`,
        true,
      ),
    ]),

    // Investigate
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "Three test failures:\n1. Dashboard shows session count 3 instead of expected 5 — likely a data change from the merge\n2. Sidebar can't find text \"Dashboard\" — probably a label rename\n3. Sidebar can't find toggle button — likely a UI restructure from the merge\n\nLet me check what changed in the merge.",
        ),
        text("Three failures. Let me check what changed in the merge that could cause these."),
        toolUse(t2, "Grep", {
          pattern: "Dashboard|Toggle sidebar",
          path: `${DASHBOARD_CWD}/src/components/Sidebar.tsx`,
        }),
        toolUse(t3, "Read", { file_path: `${DASHBOARD_CWD}/src/components/Sidebar.test.tsx` }),
      ],
      "tool_use",
      {
        input_tokens: 3800,
        output_tokens: 180,
        cache_read_input_tokens: 10000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t2,
        `src/components/Sidebar.tsx:15:      <span>Home</span>\nsrc/components/Sidebar.tsx:28:      <button aria-label="Close menu" onClick={onToggle}>`,
      ),
      toolResult(
        t3,
        `     1\t| import { render, screen } from "@testing-library/react";\n     2\t| import { Sidebar } from "./Sidebar";\n     3\t|\n     4\t| test("renders navigation links", () => {\n     5\t|   render(<Sidebar activeRoute="/" onToggle={() => {}} />);\n     6\t|   expect(screen.getByText("Projects")).toBeTruthy();\n     7\t| });\n     8\t|\n     9\t| test("highlights active route", () => {\n    10\t|   render(<Sidebar activeRoute="/dashboard" onToggle={() => {}} />);\n    11\t|   // This expects "Dashboard" but the component now renders "Home"\n    12\t|   expect(screen.getByText("Dashboard")).toBeTruthy();\n    13\t| });\n    14\t|\n    15\t| test("collapses on mobile", () => {\n    16\t|   render(<Sidebar activeRoute="/" onToggle={() => {}} />);\n    17\t|   // This expects "Toggle sidebar" but the button now says "Close menu"\n    18\t|   expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBeTruthy();\n    19\t| });\n`,
      ),
    ]),

    // Fix the tests
    assistantLine(
      ts,
      OPUS,
      [
        text(
          'Found the issues. The merge renamed "Dashboard" to "Home" in the sidebar and changed the toggle button\'s `aria-label` from "Toggle sidebar" to "Close menu". The tests need to match the new labels.',
        ),
        toolUse(t4, "Edit", {
          file_path: `${DASHBOARD_CWD}/src/components/Sidebar.test.tsx`,
          old_string: `expect(screen.getByText("Dashboard")).toBeTruthy();`,
          new_string: `expect(screen.getByText("Home")).toBeTruthy();`,
        }),
        toolUse(t5, "Edit", {
          file_path: `${DASHBOARD_CWD}/src/components/Sidebar.test.tsx`,
          old_string: `expect(screen.getByRole("button", { name: "Toggle sidebar" })).toBeTruthy();`,
          new_string: `expect(screen.getByRole("button", { name: "Close menu" })).toBeTruthy();`,
        }),
      ],
      "tool_use",
      {
        input_tokens: 4500,
        output_tokens: 250,
        cache_read_input_tokens: 10000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(t4, "Successfully edited src/components/Sidebar.test.tsx"),
      toolResult(t5, "Successfully edited src/components/Sidebar.test.tsx"),
    ]),

    // Run tests again
    assistantLine(
      ts,
      OPUS,
      [
        text(
          "Now let me run the tests again. I still need to fix the session count test — let me check the Dashboard test after this run.",
        ),
        toolUse(t6, "Bash", {
          command: "cd /Users/demo/projects/react-dashboard && bun test",
          description: "Run tests",
        }),
      ],
      "tool_use",
      {
        input_tokens: 5000,
        output_tokens: 100,
        cache_read_input_tokens: 10000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t6,
        "bun test v1.2.4\n\nDashboard.test.tsx:\n✓ renders dashboard header [8ms]\n✓ displays project list [12ms]\n✓ shows correct session count [4ms]\n\nBarChart.test.tsx:\n✓ renders chart with data [14ms]\n✓ handles empty data [3ms]\n\nSidebar.test.tsx:\n✓ renders navigation links [4ms]\n✓ highlights active route [5ms]\n✓ collapses on mobile [6ms]\n\n 8 pass\n 0 fail\n Ran 8 tests in 198ms",
      ),
    ]),

    // All pass
    assistantLine(
      ts,
      OPUS,
      [
        text(
          'All 8 tests pass now. The session count test also passes — it seems the first run had stale test data.\n\n**Fixes applied:**\n1. Updated `Sidebar.test.tsx` to expect "Home" instead of "Dashboard" (label was renamed in the merge)\n2. Updated toggle button `aria-label` expectation from "Toggle sidebar" to "Close menu"',
        ),
      ],
      "end_turn",
      {
        input_tokens: 5500,
        output_tokens: 200,
        cache_read_input_tokens: 10000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Slash command: /commit
    userLine(
      ts,
      `<command-message>commit</command-message>\n<command-name>/commit</command-name>\n<command-args>fix: update sidebar tests to match renamed labels from main merge</command-args>`,
      common,
    ),

    assistantLine(
      ts,
      OPUS,
      [
        toolUse(t7, "Bash", {
          command: `cd /Users/demo/projects/react-dashboard && git add src/components/Sidebar.test.tsx && git commit -m "$(cat <<'EOF'\nfix: update sidebar tests to match renamed labels from main merge\n\nThe merge from main renamed 'Dashboard' to 'Home' in the sidebar\nand changed the toggle button aria-label. Updated test expectations\nto match.\n\nCo-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>\nEOF\n)"`,
          description: "Stage and commit test fixes",
        }),
      ],
      "tool_use",
      {
        input_tokens: 6000,
        output_tokens: 200,
        cache_read_input_tokens: 10000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t7,
        "[fix/tests a4c8f21] fix: update sidebar tests to match renamed labels from main merge\n 1 file changed, 2 insertions(+), 2 deletions(-)",
      ),
    ]),

    assistantLine(ts, OPUS, [text("Committed on `fix/tests` as `a4c8f21`.")], "end_turn", {
      input_tokens: 6500,
      output_tokens: 40,
      cache_read_input_tokens: 10000,
      cache_creation_input_tokens: 0,
    }),
  ];

  writeSession(DASHBOARD_PROJECT, SESSION_ID, lines);
}

// ---------------------------------------------------------------------------
// Project 3: API Backend (-Users-demo-projects-api-backend)
// ---------------------------------------------------------------------------
const API_PROJECT = "-Users-demo-projects-api-backend";
const API_CWD = "/Users/demo/projects/api-backend";

// --- Session 6: Optimize database queries (NotebookRead/Edit, status notices) ---
function session6_optimize(): void {
  const SESSION_ID = "f6a7b8c9-d0e1-4f2a-3b4c-d5e6f7a8b9c0";
  const SLUG = "api-optimize-queries";
  const ts = timestamps("2026-02-15T08:00:00Z");
  const common = { slug: SLUG, cwd: API_CWD, gitBranch: "perf/queries", version: "1.0.48" };

  const t1 = toolId(); // Bash (EXPLAIN)
  const t2 = toolId(); // NotebookRead
  const t3 = toolId(); // Read
  const t4 = toolId(); // Edit
  const t5 = toolId(); // NotebookEdit
  const t6 = toolId(); // Bash (benchmark)

  const lines = [
    // System message
    systemLine(
      ts,
      "You are Claude, an AI assistant helping with backend performance optimization.",
      common,
    ),

    // User asks about performance
    userLine(
      ts,
      "The `/api/users` endpoint takes 2.3s to respond. The database has 50k users. Can you optimize the queries?",
      common,
    ),

    // Assistant investigates
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "2.3s for 50k users is way too slow. The most common causes are:\n1. Missing indexes on frequently queried columns\n2. N+1 query patterns\n3. Loading all records when only a page is needed\n\nLet me check the query execution plan and the existing code.",
        ),
        text("2.3s is very slow for 50k records. Let me check the query execution plan."),
        toolUse(t1, "Bash", {
          command: `cd /Users/demo/projects/api-backend && bun run -e "
import { Database } from 'bun:sqlite';
const db = new Database('app.db');
console.log(JSON.stringify(db.query('EXPLAIN QUERY PLAN SELECT * FROM users WHERE email LIKE ? ORDER BY created_at DESC LIMIT 20').all('%@gmail%'), null, 2));
"`,
          description: "Run EXPLAIN QUERY PLAN on users query",
        }),
      ],
      "tool_use",
      {
        input_tokens: 3500,
        output_tokens: 300,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 9500,
      },
      common,
    ),

    userLine(ts, [
      toolResult(
        t1,
        '[\n  {\n    "id": 0,\n    "parent": 0,\n    "detail": "SCAN users"\n  },\n  {\n    "id": 0,\n    "parent": 0,\n    "detail": "USE TEMP B-TREE FOR ORDER BY"\n  }\n]',
      ),
    ]),

    // Check the notebook
    assistantLine(
      ts,
      OPUS,
      [
        text(
          "As I suspected — it's doing a full table **SCAN** (no index) and a temp B-tree for sorting. Let me also check if there's a performance analysis notebook.",
        ),
        toolUse(t2, "NotebookRead", {
          notebook_path: `${API_CWD}/benchmarks/query-analysis.ipynb`,
        }),
        toolUse(t3, "Read", { file_path: `${API_CWD}/src/routes/users.ts` }),
      ],
      "tool_use",
      {
        input_tokens: 4000,
        output_tokens: 150,
        cache_read_input_tokens: 9500,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t2,
        "Notebook: query-analysis.ipynb\n\nCell 1 [markdown]:\n# Query Performance Analysis\nBaseline measurements for API endpoints.\n\nCell 2 [code]:\nimport time\nresults = {}\n\nCell 3 [code]:\n# Users endpoint - current performance\nstart = time.time()\nfor i in range(100):\n    resp = requests.get('http://localhost:3000/api/users')\nresults['users_avg'] = (time.time() - start) / 100\nprint(f\"Average: {results['users_avg']:.3f}s\")\n\nOutput: Average: 2.341s\n\nCell 4 [markdown]:\n## Results\n| Endpoint | Avg Response Time |\n|----------|------------------|\n| /api/users | 2.341s |\n| /api/posts | 0.045s |",
      ),
      toolResult(
        t3,
        `     1\t| import { db } from "../db.ts";\n     2\t|\n     3\t| export const userRoutes = {\n     4\t|   "/api/users": {\n     5\t|     GET: (req: Request) => {\n     6\t|       const url = new URL(req.url);\n     7\t|       const search = url.searchParams.get("search") || "";\n     8\t|       // BUG: No pagination, loads ALL matching records\n     9\t|       const users = db.query(\n    10\t|         "SELECT * FROM users WHERE email LIKE ? ORDER BY created_at DESC"\n    11\t|       ).all(\`%\${search}%\`);\n    12\t|       return Response.json(users);\n    13\t|     },\n    14\t|   },\n    15\t| };\n`,
      ),
    ]),

    // Apply fixes
    assistantLine(
      ts,
      OPUS,
      [
        thinking(
          "Two issues:\n1. No index on `email` or `created_at` — causing full table scan\n2. No pagination — loading all 50k records at once\n\nFixes:\n1. Add an index on `email` and `created_at`\n2. Add LIMIT/OFFSET pagination with a default page size of 20",
        ),
        text(
          "Found two issues:\n1. **No indexes** — full table scan on 50k rows\n2. **No pagination** — loading all records at once\n\nLet me fix both.",
        ),
        toolUse(t4, "Edit", {
          file_path: `${API_CWD}/src/routes/users.ts`,
          old_string: `      // BUG: No pagination, loads ALL matching records
      const users = db.query(
        "SELECT * FROM users WHERE email LIKE ? ORDER BY created_at DESC"
      ).all(\`%\${search}%\`);
      return Response.json(users);`,
          new_string: `      const page = Number(url.searchParams.get("page") || "1");
      const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 100);
      const offset = (page - 1) * limit;

      const users = db.query(
        "SELECT * FROM users WHERE email LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).all(\`%\${search}%\`, limit, offset);

      const [{ total }] = db.query(
        "SELECT COUNT(*) as total FROM users WHERE email LIKE ?"
      ).all(\`%\${search}%\`) as [{ total: number }];

      return Response.json({ users, total, page, limit });`,
        }),
      ],
      "tool_use",
      {
        input_tokens: 5000,
        output_tokens: 600,
        cache_read_input_tokens: 9500,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t4, "Successfully edited src/routes/users.ts")]),

    // Update the notebook with new benchmark
    assistantLine(
      ts,
      OPUS,
      [
        text("Now let me add the index and update the benchmark notebook."),
        toolUse(t5, "NotebookEdit", {
          notebook_path: `${API_CWD}/benchmarks/query-analysis.ipynb`,
          cell_number: 4,
          new_source:
            "# After optimization\nstart = time.time()\nfor i in range(100):\n    resp = requests.get('http://localhost:3000/api/users?limit=20')\nresults['users_optimized'] = (time.time() - start) / 100\nprint(f\"Optimized: {results['users_optimized']:.3f}s\")\nprint(f\"Improvement: {results['users_avg'] / results['users_optimized']:.1f}x faster\")",
          cell_type: "code",
          edit_mode: "insert",
        }),
      ],
      "tool_use",
      {
        input_tokens: 5500,
        output_tokens: 300,
        cache_read_input_tokens: 9500,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t5, "Inserted new cell 4 in query-analysis.ipynb")]),

    // Status notice: Context compressed
    userLine(ts, "[Context compressed]"),

    // Benchmark
    assistantLine(
      ts,
      OPUS,
      [
        toolUse(t6, "Bash", {
          command: `cd /Users/demo/projects/api-backend && bun run -e "
import { Database } from 'bun:sqlite';
const db = new Database('app.db');
db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
db.run('CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at DESC)');
console.log('Indexes created.');
const start = performance.now();
for (let i = 0; i < 100; i++) {
  db.query('SELECT * FROM users WHERE email LIKE ? ORDER BY created_at DESC LIMIT 20').all('%@gmail%');
}
const avg = (performance.now() - start) / 100;
console.log('Average query time: ' + avg.toFixed(1) + 'ms');
"`,
          description: "Create indexes and benchmark",
        }),
      ],
      "tool_use",
      {
        input_tokens: 6000,
        output_tokens: 250,
        cache_read_input_tokens: 9500,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t6, "Indexes created.\nAverage query time: 1.8ms")]),

    // Session resumed notice
    userLine(ts, "[Session resumed]"),

    // Final summary
    assistantLine(
      ts,
      OPUS,
      [
        text(
          'Massive improvement! Query time went from **2,341ms → 1.8ms** (1,300x faster).\n\n**Changes made:**\n1. Added pagination with `LIMIT`/`OFFSET` to `src/routes/users.ts`\n2. Created indexes on `email` and `created_at` columns\n3. Updated the benchmark notebook with post-optimization measurements\n\nThe `/api/users` endpoint now returns paginated results:\n```json\n{\n  "users": [...],\n  "total": 50000,\n  "page": 1,\n  "limit": 20\n}\n```',
        ),
      ],
      "end_turn",
      {
        input_tokens: 6500,
        output_tokens: 350,
        cache_read_input_tokens: 9500,
        cache_creation_input_tokens: 0,
      },
    ),
  ];

  writeSession(API_PROJECT, SESSION_ID, lines);
}

// --- Session 7: Setup CI/CD (AskUserQuestion, Skill, bash-input, ide_opened_file, TodoWrite, KillShell, WebSearch) ---
function session7_cicd(): void {
  const SESSION_ID = "a7b8c9d0-e1f2-4a3b-4c5d-e6f7a8b9c0d1";
  const SLUG = "api-cicd-setup";
  const ts = timestamps("2026-02-16T10:00:00Z");
  const common = { slug: SLUG, cwd: API_CWD, gitBranch: "feat/ci-cd", version: "1.0.49" };

  const t1 = toolId(); // TodoWrite
  const t2 = toolId(); // WebSearch
  const t3 = toolId(); // Write ci.yml
  const t4 = toolId(); // Write Dockerfile
  const t5 = toolId(); // Bash (docker build - long running)
  const t6 = toolId(); // KillShell
  const t7 = toolId(); // Bash (docker build - fixed)
  const t8 = toolId(); // Skill (verify)

  const lines = [
    // User asks for CI/CD
    userLine(
      ts,
      "Set up a CI/CD pipeline with GitHub Actions. I need lint, test, and Docker build stages.",
      common,
    ),

    // User sends bash-input (terminal paste - shows what they tried before asking)
    userLine(ts, "<bash-input>cat .github/workflows/ci.yml</bash-input>", common),

    // User opens file in IDE
    userLine(
      ts,
      `<ide_opened_file>The user opened the file ${API_CWD}/src/config.ts in the IDE</ide_opened_file>`,
      common,
    ),

    // Assistant plans
    assistantLine(
      ts,
      HAIKU,
      [
        thinking(
          "The user wants a CI/CD pipeline with GitHub Actions. They need:\n1. Lint stage (probably biome or eslint)\n2. Test stage (bun test)\n3. Docker build stage\n\nI noticed from the bash-input that they tried to cat the CI config but it doesn't exist yet. And they opened config.ts in the IDE, which might have relevant environment settings.\n\nLet me create a TODO list to track the work, then set up the pipeline.",
        ),
        text("I'll set up a complete CI/CD pipeline. Let me track the tasks first."),
        toolUse(t1, "TodoWrite", {
          subject: "Create GitHub Actions workflow with lint, test, and Docker build",
        }),
      ],
      "tool_use",
      {
        input_tokens: 2500,
        output_tokens: 150,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 7000,
      },
      common,
    ),

    userLine(ts, [
      toolResult(
        t1,
        "Todo created: Create GitHub Actions workflow with lint, test, and Docker build",
      ),
    ]),

    // Search for best practices
    assistantLine(
      ts,
      HAIKU,
      [
        toolUse(t2, "WebSearch", {
          query: "GitHub Actions Bun CI/CD best practices 2026 Docker multi-stage",
        }),
      ],
      "tool_use",
      {
        input_tokens: 3000,
        output_tokens: 80,
        cache_read_input_tokens: 7000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t2,
        "Search results:\n1. 'Setting up CI with Bun' - docs.bun.sh - Use oven-sh/setup-bun action\n2. 'Docker multi-stage builds for Bun' - blog.example.com - Use oven/bun:1 base image\n3. 'GitHub Actions best practices 2026' - github.blog - Matrix testing, caching, reusable workflows",
      ),
    ]),

    // Write CI config
    assistantLine(
      ts,
      HAIKU,
      [
        text("I'll create the workflow file and a multi-stage Dockerfile."),
        toolUse(t3, "Write", {
          file_path: `${API_CWD}/.github/workflows/ci.yml`,
          content: `name: CI/CD\n\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\n\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: latest\n      - run: bun install --frozen-lockfile\n      - run: bun run check\n\n  test:\n    runs-on: ubuntu-latest\n    needs: lint\n    steps:\n      - uses: actions/checkout@v4\n      - uses: oven-sh/setup-bun@v2\n      - run: bun install --frozen-lockfile\n      - run: bun test\n\n  build:\n    runs-on: ubuntu-latest\n    needs: test\n    if: github.ref == 'refs/heads/main'\n    steps:\n      - uses: actions/checkout@v4\n      - uses: docker/setup-buildx-action@v3\n      - uses: docker/login-action@v3\n        with:\n          registry: ghcr.io\n          username: \${{ github.actor }}\n          password: \${{ secrets.GITHUB_TOKEN }}\n      - uses: docker/build-push-action@v5\n        with:\n          push: true\n          tags: ghcr.io/\${{ github.repository }}:latest\n          cache-from: type=gha\n          cache-to: type=gha,mode=max\n`,
        }),
        toolUse(t4, "Write", {
          file_path: `${API_CWD}/Dockerfile`,
          content: `# Stage 1: Install dependencies\nFROM oven/bun:1 AS deps\nWORKDIR /app\nCOPY package.json bun.lock ./\nRUN bun install --frozen-lockfile --production\n\n# Stage 2: Build\nFROM oven/bun:1 AS build\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN bun build src/index.ts --target=bun --outdir=./dist\n\n# Stage 3: Production\nFROM oven/bun:1-slim\nWORKDIR /app\nCOPY --from=build /app/dist ./dist\nCOPY --from=deps /app/node_modules ./node_modules\n\nEXPOSE 3000\nCMD ["bun", "run", "dist/index.js"]\n`,
        }),
      ],
      "tool_use",
      {
        input_tokens: 3500,
        output_tokens: 1200,
        cache_read_input_tokens: 7000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(t3, `Successfully wrote to ${API_CWD}/.github/workflows/ci.yml (42 lines)`),
      toolResult(t4, `Successfully wrote to ${API_CWD}/Dockerfile (20 lines)`),
    ]),

    // Docker build (long running - needs to be killed)
    assistantLine(
      ts,
      HAIKU,
      [
        text("Let me verify the Docker build works locally."),
        toolUse(t5, "Bash", {
          command: "cd /Users/demo/projects/api-backend && docker build -t api-backend:test .",
          description: "Build Docker image",
          timeout: 120000,
        }),
      ],
      "tool_use",
      {
        input_tokens: 4000,
        output_tokens: 100,
        cache_read_input_tokens: 7000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Build times out / hangs
    userLine(ts, [
      toolResult(
        t5,
        "Step 1/12 : FROM oven/bun:1 AS deps\n ---> a3f4b5c6d7e8\nStep 2/12 : WORKDIR /app\n ---> Using cache\nStep 3/12 : COPY package.json bun.lock ./\nCOPY failed: file not found in build context: bun.lock",
        true,
      ),
    ]),

    // Kill the shell and fix
    assistantLine(
      ts,
      HAIKU,
      [
        thinking(
          "The Docker build failed because there's no `bun.lock` file — the project uses `bun.lockb` (the binary lockfile format). I need to update the Dockerfile to reference the correct lockfile name.",
        ),
        text(
          "The build failed because Bun uses `bun.lockb` (binary format), not `bun.lock`. Let me fix the Dockerfile.",
        ),
        toolUse(t6, "KillShell", { task_id: "docker-build-1" }),
      ],
      "tool_use",
      {
        input_tokens: 4500,
        output_tokens: 150,
        cache_read_input_tokens: 7000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [toolResult(t6, "Shell terminated")]),

    // Fixed Docker build
    assistantLine(
      ts,
      HAIKU,
      [
        toolUse(t7, "Bash", {
          command: `cd /Users/demo/projects/api-backend && sed -i 's/bun.lock/bun.lockb/g' Dockerfile && docker build -t api-backend:test .`,
          description: "Fix lockfile name and rebuild Docker image",
        }),
      ],
      "tool_use",
      {
        input_tokens: 5000,
        output_tokens: 100,
        cache_read_input_tokens: 7000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t7,
        'Step 1/12 : FROM oven/bun:1 AS deps\n ---> a3f4b5c6d7e8\nStep 2/12 : WORKDIR /app\nStep 3/12 : COPY package.json bun.lockb ./\nStep 4/12 : RUN bun install --frozen-lockfile --production\n ---> Running in abc123\nInstalled 45 packages in 1.2s\nStep 12/12 : CMD ["bun", "run", "dist/index.js"]\nSuccessfully built e9f8a7b6c5d4\nSuccessfully tagged api-backend:test',
      ),
    ]),

    // Run verification skill
    assistantLine(
      ts,
      HAIKU,
      [
        text("Docker build works. Let me run the verification suite."),
        toolUse(t8, "Skill", { skill: "verify" }),
      ],
      "tool_use",
      {
        input_tokens: 5500,
        output_tokens: 80,
        cache_read_input_tokens: 7000,
        cache_creation_input_tokens: 0,
      },
    ),

    userLine(ts, [
      toolResult(
        t8,
        "Running verification...\n\n✓ bun run check — 0 issues\n✓ bun run typecheck — no errors\n✓ bun test — 12 pass, 0 fail\n\nAll checks passed!",
      ),
    ]),

    // Final summary
    assistantLine(
      ts,
      HAIKU,
      [
        text(
          "CI/CD pipeline is set up and verified!\n\n**Created files:**\n- `.github/workflows/ci.yml` — 3-stage pipeline (lint → test → Docker build+push)\n- `Dockerfile` — multi-stage build with `oven/bun:1` base image\n\n**Pipeline stages:**\n1. **Lint** — runs `bun run check` (Biome)\n2. **Test** — runs `bun test`\n3. **Build** — Docker multi-stage build, pushes to `ghcr.io` (main branch only)\n\n**Features:**\n- GitHub Actions cache for Docker layers (`type=gha`)\n- Frozen lockfile installs for reproducibility\n- Production-only dependencies in final image\n- Slim base image (`oven/bun:1-slim`) for smaller footprint",
        ),
      ],
      "end_turn",
      {
        input_tokens: 6000,
        output_tokens: 400,
        cache_read_input_tokens: 7000,
        cache_creation_input_tokens: 0,
      },
    ),

    // Some filtered content types (present in file but skipped by parser)
    L({
      type: "user",
      isMeta: true,
      ...base(ts),
      message: { role: "user", content: "Auto-save notification" },
    }),

    L({
      type: "progress",
      data: {
        type: "mcp_progress",
        status: "connecting",
        serverName: "github",
        toolName: "create_issue",
      },
    }),
  ];

  writeSession(API_PROJECT, SESSION_ID, lines);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
session1_plan();
session2_implementation();
session3_bugfix();
session4_charts();
session5_tests();
session6_optimize();
session7_cicd();

console.log("Demo data generated in demo-data/claude-code/projects/");
console.log("\nProjects:");
console.log("  - todo-app (3 sessions: plan, implementation, bugfix)");
console.log("  - react-dashboard (2 sessions: charts, test fixes)");
console.log("  - api-backend (2 sessions: query optimization, CI/CD setup)");
console.log("\nUse: bun run dev -- --claude-code-dir ./demo-data/claude-code");
