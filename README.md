## Understanding React

This project is an AST explorer for React JSX written in TypeScript. It parses a TSX file with Babel and prints a readable tree of:

- JSX elements and fragments
- props
- text nodes
- expression containers
- nested JSX inside expressions such as `map`, conditionals, and logical `&&`
- source locations

### Quick Start

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Run the explorer against the demo file:

   ```bash
   pnpm start
   ```

3. Watch the file while you edit:

   ```bash
   pnpm watch
   ```

### Commands

Explore the default file:

```bash
pnpm start
```

Explore a specific file:

```bash
pnpm start -- src/App.tsx
```

Print the source code before the tree:

```bash
pnpm start -- --code
```

Hide the summary:

```bash
pnpm start -- --no-summary
```

Hide line and column locations:

```bash
pnpm start -- --no-loc
```

### Demo File

The sample [`src/App.tsx`](./src/App.tsx) includes:

- fragments
- custom components
- props with expressions
- conditional rendering
- `map` rendering
- nested JSX inside expression containers

Open that file and change the JSX to see how the AST tree changes.
