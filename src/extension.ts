import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

export function activate(context: vscode.ExtensionContext) {
  console.log('✅ Extension activated!');

  let disposable = vscode.commands.registerCommand('db-crud-api-generator.generateCrudApi', async () => {
    console.log('🚀 Command executed');

    // Step 1: Prompt for language
    const language = await vscode.window.showQuickPick(
      ['Python', 'Java', 'C++', 'JavaScript'],
      { placeHolder: 'Select a programming language' }
    );

    if (!language) {
      vscode.window.showWarningMessage('⚠️ Language selection was cancelled.');
      return;
    }

    // Step 2: Prompt for database
    const database = await vscode.window.showQuickPick(
      ['MongoDB', 'MySQL', 'PostgreSQL'],
      { placeHolder: 'Select a database' }
    );

    if (!database) {
      vscode.window.showWarningMessage('⚠️ Database selection was cancelled.');
      return;
    }

    // Step 3: Prompt for API description
    const prompt = await vscode.window.showInputBox({
      prompt: 'What should the API do? (e.g., manage users, handle products)',
    });

    if (!prompt) {
      vscode.window.showWarningMessage('⚠️ API description was cancelled.');
      return;
    }

    vscode.window.showInformationMessage(`Generating ${language} CRUD API for ${database}...`);

    // Step 4: Construct prompt for Ollama
    const userPrompt = `
You are a code generator. Generate a full project (including folders and files) for a ${language} CRUD API using ${database}.
The API should: ${prompt}.
Respond in this format:
\`\`\`file: filename
<file content>
\`\`\`
Repeat for all files required. No explanations.
    `.trim();

    // Step 5: Call local Ollama server
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'codellama',
        prompt: userPrompt,
        stream: false
      })
    });

    const data = await response.json();
    const text = data.response;

    // Step 6: Get the current workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('Please open a folder or workspace to generate the project into.');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Step 7: Parse and create each file
    const fileBlocks = text.split('```').filter((block: string) => block.trim().startsWith('file:'));
    for (const block of fileBlocks) {
      const lines = block.trim().split('\n');
      const filePathLine = lines[0];
      const fileContent = lines.slice(1).join('\n');
      const relativePath = filePathLine.replace('file:', '').trim();
      const fullPath = path.join(rootPath, relativePath);

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, fileContent);
    }

    vscode.window.showInformationMessage('✅ CRUD API project generated successfully!');
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}