import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
    try {
        // Read the JSON file from the project root
        const filePath = join(process.cwd(), '..', '.local.output.json');
        const fileContent = readFileSync(filePath, 'utf-8');
        const highlights = JSON.parse(fileContent);

        return NextResponse.json(highlights);
    } catch (error) {
        console.error('Error reading highlights file:', error);
        return NextResponse.json(
            { error: 'Failed to load highlights' },
            { status: 500 }
        );
    }
} 