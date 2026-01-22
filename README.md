# Workflow Step Finder

A Contentful app that displays all workflow definitions and their step IDs in a hierarchical view, accessible as a config screen.

## Features

- ✅ Hierarchical display of workflows and steps
- ✅ Shows workflow name + workflow ID
- ✅ Shows step name + step ID
- ✅ Copy buttons for easy ID copying
- ✅ Config screen location (full page app)
- ✅ Uses Forma36 design system
- ✅ TypeScript support

## Project Structure

```
workflow-step-finder/
├── src/
│   ├── components/
│   │   └── LocalhostWarning.tsx
│   ├── locations/
│   │   ├── ConfigScreen.tsx
│   │   ├── Dialog.tsx
│   │   ├── EntryEditor.tsx
│   │   ├── Field.tsx
│   │   ├── Home.tsx
│   │   ├── Page.tsx
│   │   └── Sidebar.tsx
│   ├── App.tsx
│   └── index.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.mts
└── README.md
```

## Development

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm start
# or
npm run dev
```

The app will be available at `https://localhost:3000`

### Build for Production

```bash
npm run build
```

This creates a `dist/` folder with the built app.

### Run Tests

```bash
npm test
# or for CI
npm run test:ci
```

## Installation in Contentful

### Option 1: Using Contentful CLI

1. Install Contentful CLI if you haven't:
   ```bash
   npm install -g contentful-cli
   ```

2. Login to Contentful:
   ```bash
   contentful login
   ```

3. Create the app definition:
   ```bash
   contentful app create
   ```
   Follow the prompts and use the `app.json` file.

4. Upload the app bundle:
   ```bash
   contentful app upload
   ```

### Option 2: Using Contentful Web UI

1. Build the app: `npm run build`
2. Host the `dist/` folder (or use Contentful app hosting)
3. Go to Contentful → Settings → Apps → Create App
4. Upload `app.json` and provide the hosted URL
5. Install the app in your space

## Usage

Once installed:
1. Go to Contentful Settings → Apps
2. Click on "Workflow Step Finder"
3. View all workflows and their step IDs in a hierarchical format
4. Copy IDs as needed

## API Endpoints Used

- `GET /spaces/{spaceId}/environments/{environmentId}/workflow_definitions` - Fetches all workflows
- Uses Contentful Management API (CMA) via `@contentful/react-apps-toolkit`

## Troubleshooting

- If the app doesn't load, check that HTTPS is enabled (required by Contentful)
- Make sure the app URL in `app.json` matches your hosted URL
- Verify you have the correct permissions to access workflow definitions
- Check browser console for any errors
