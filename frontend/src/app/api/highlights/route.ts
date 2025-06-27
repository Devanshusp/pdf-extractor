import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const {
            pdf_url,
            by,
            filter_non_english_words,
            min_word_length,
            min_word_frequency,
            remove_non_alpha
        } = await request.json();

        const apiRes = await fetch('http://localhost:8000/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdf_url,
                by,
                filter_non_english_words,
                min_word_length,
                min_word_frequency,
                remove_non_alpha
            }),
        });

        if (!apiRes.ok) {
            const error = await apiRes.json();
            return NextResponse.json({ error: error.detail || 'Backend error' }, { status: 500 });
        }

        const data = await apiRes.json();
        return NextResponse.json({
            text_chunks: data.text_chunks || [],
            run_time_seconds: data.run_time_seconds ?? null
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to extract highlights' }, { status: 500 });
    }
} 