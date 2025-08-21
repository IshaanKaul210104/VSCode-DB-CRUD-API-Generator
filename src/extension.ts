import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
const fetch = require('node-fetch');

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
    const userInput = await vscode.window.showInputBox({
      prompt: 'What should the API do? (e.g., manage users, handle products)',
    });

    if (!userInput) {
      vscode.window.showWarningMessage('⚠️ API description was cancelled.');
      return;
    }

    vscode.window.showInformationMessage(`💡 Interpreting prompt with llama3:8b...`);

    // Step 4: llama3 prompt to convert natural language into code spec
    const interpretationPrompt = `
Given the following natural language request:

"Build a ${language} CRUD API using ${database}. The API should: ${userInput}"

Output a structured plan describing:
- Required project structure (e.g., folders/files)
- Technologies/frameworks involved (e.g., Flask, Express)
- Entities/models (e.g., User, Product)
Respond in plain English for another model to understand. Be concise and clear.
    `.trim();

    let structuredSpec;
    try {
        const llamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'applicatiojn/json' },
            body: JSON.stringify({
                model: 'llama3.1:8b',
                prompt: interpretationPrompt,
                stream: false
            })
        });

        if (!llamaResponse.ok) {
            vscode.window.showErrorMessage(`Error from llama3.1:8b: ${llamaResponse.statusText}`);
            return;
        }

        const llamaData = await llamaResponse.json();
        structuredSpec = llamaData.response.trim();
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to connect to Ollama: ${error.message}`);
        return;
    }


    vscode.window.showInformationMessage(`🛠️ Generating code with codellama:13b...`);

    // Step 5: codellama prompt with structured spec
    const generationPrompt = `
You are a code generator. Based on the following structured spec, generate a complete ${language} CRUD API project using ${database}.

${structuredSpec}

Respond ONLY with file outputs in this format:
\`\\\`\\\`file: filename
<file content>\`\\\`\\\`

Repeat for every file and folder. Do not add any explanation.
    `.trim();

    let text;

    try {
        const codeResponse = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'codellama:13b',
            prompt: generationPrompt,
            stream: false
          })
        });

        if (!codeResponse.ok) {
            vscode.window.showErrorMessage(`Error from codellama:13b: ${codeResponse.statusText}`);
            return;
        }
    
        const codeData = await codeResponse.json();
        text = codeData.response;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to connect to Ollama: ${error.message}`);
        return;
    }

    // Step 6: Workspace check
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('Please open a folder or workspace to generate the project into.');
      return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Step 7: Parse and write files
    try {
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
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error writing files: ${error.message}`);
        return;
    }

    vscode.window.showInformationMessage('✅ CRUD API project generated successfully!');
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}