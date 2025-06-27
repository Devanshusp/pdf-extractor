import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { pdf_url, by, clean_spans, clean_text } = await request.json();

        // Call your FastAPI backend
        const apiRes = await fetch('http://localhost:8000/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdf_url, by, clean_spans, clean_text }),
        });

        if (!apiRes.ok) {
            const error = await apiRes.json();
            return NextResponse.json({ error: error.detail || 'Backend error' }, { status: 500 });
        }

        const data = await apiRes.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to extract highlights' }, { status: 500 });
    }
} 