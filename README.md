# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## 🚀 Deployment (Cloudflare Pages)

The easiest way to deploy is using Cloudflare Pages with Git integration.

1.  **Fork this repository** to your GitHub account.
2.  **Log in to Cloudflare Dashboard** > **Workers & Pages** > **Create Application** > **Pages** > **Connect to Git**.
3.  Select the `pastebin` repository.
4.  **Configure Build Settings**:
    - **Framework Preset**: Vite
    - **Build Command**: `npm run build`
    - **Build Output Directory**: `dist`
5.  **Environment Variables**:
    - Add `AUTH_KEY`: Your secret passphrase for logging in.
6.  **Save and Deploy**.

### ⚠️ Important: Database Setup
After the first deployment fails (or succeeds but shows errors), you must bind the D1 database:

1.  Go to **Workers & Pages** > **D1** and create a database named `pastebin-db`.
2.  Go to your Pages project > **Settings** > **Functions**.
3.  Scroll to **D1 Database Bindings**.
4.  Add binding:
    - Variable name: `DB`
    - Namespace: `pastebin-db` (select the one you created).
5.  **Redeploy** the latest commit for changes to take effect.
6.  **Initialize the Schema**:
    Go to **D1** > `pastebin-db` > **Console** and paste the contents of `schema.sql` to create the tables.

## 🛠️ Local Development

1.  **Run the Setup Script** (Windows):
    ```powershell
    .\setup.ps1
    ```

    Or manually:
    ```bash
    bun install
    bun run db:create
    bun run db:migrate:local
    bun run dev:api
    ```

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
