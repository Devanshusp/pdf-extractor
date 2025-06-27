// src/app/page.tsx
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { CanvasLayer, HighlightLayer, Page, Pages, Root, TextLayer, usePdfJump, usePdf } from "@anaralabs/lector";
import "@/lib/setup";
import { VariableSizeList as List, ListChildComponentProps } from 'react-window';

interface TextChunk {
  page_number: number;
  text: string;
  px_left: number;
  px_bottom: number;
  width: number;
  height: number;
}

interface HighlightRect {
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const DEFAULT_PDF_URL = 'https://d6ziqu2pgbz50.cloudfront.net/content/d62bb70c7285458685917e555ad89819.pdf';

function HighlightsPanel({
  selectedExample,
  setSelectedExample,
  highlights,
  loading,
  runTimeSeconds,
}: {
  selectedExample: number | null;
  setSelectedExample: (index: number) => void;
  highlights: TextChunk[];
  loading: boolean;
  runTimeSeconds: number | null;
}) {
  const setHighlight = usePdf(state => state.setHighlight);
  const { jumpToHighlightRects } = usePdfJump();

  const handleExampleClick = (example: TextChunk, index: number) => {
    setSelectedExample(index);
    const highlightRect = textChunkToHighlightRect(example);
    setHighlight([highlightRect]);
    jumpToHighlightRects([highlightRect], "pixels");
  };

  const getItemSize = useCallback((index: number) => {
    const chunk = highlights[index];
    if (!chunk) return 56;
    const charCount = chunk.text.length;
    const baseHeight = 32;
    const lineHeight = 20;
    const estimatedLines = Math.max(1, Math.ceil(charCount / 50));
    return baseHeight + (estimatedLines * lineHeight);
  }, [highlights]);

  // memoize for optimmization
  const itemSize = useMemo(() => getItemSize, [getItemSize]);

  return (
    <div style={{ width: 340, height: 600, borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-black">Transcript</h2>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading transcript...</div>
        ) : (
          <>
            {runTimeSeconds !== null && (
              <div className="text-xs text-gray-500 px-4 py-2 border-b border-gray-100">
                Extraction time: {runTimeSeconds.toFixed(2)} seconds
              </div>
            )}
            <List
              height={540}
              itemCount={highlights.length}
              itemSize={itemSize}
              width={340}
            >
              {({ index, style }: ListChildComponentProps) => {
                const chunk = highlights[index];
                return (
                  <div
                    key={`${chunk.page_number}-${index}`}
                    style={style}
                    onClick={() => handleExampleClick(chunk, index)}
                    className={`cursor-pointer px-3 py-2 rounded transition-colors duration-75 mb-1 text-sm leading-relaxed break-words
                      ${selectedExample === index
                        ? "bg-blue-50 text-blue-700"
                        : "bg-white text-gray-800 hover:bg-gray-100"
                      }`}
                  >
                    {chunk.text}
                  </div>
                );
              }}
            </List>
          </>
        )}
      </div>
    </div>
  );
}

function textChunkToHighlightRect(chunk: TextChunk): HighlightRect {
  return {
    pageNumber: chunk.page_number,
    left: chunk.px_left,
    top: chunk.px_bottom,
    width: chunk.width,
    height: chunk.height,
  };
}

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState(DEFAULT_PDF_URL);
  const [displayedPdfUrl, setDisplayedPdfUrl] = useState('');
  const [selectedExample, setSelectedExample] = useState<number | null>(null);
  const [highlights, setHighlights] = useState<TextChunk[]>([]);
  const [loading, setLoading] = useState(false);
  // Settings state
  const [by, setBy] = useState<'spans' | 'lines' | 'blocks'>('blocks');
  const [filterNonEnglishWords, setFilterNonEnglishWords] = useState(false);
  const [minWordLength, setMinWordLength] = useState(1);
  const [minWordFrequency, setMinWordFrequency] = useState(1);
  const [removeNonAlpha, setRemoveNonAlpha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runTimeSeconds, setRunTimeSeconds] = useState<number | null>(null);

  const loadHighlights = async (
    url?: string,
    by: "spans" | "lines" | "blocks" = "blocks",
    filter_non_english_words: boolean = true,
    min_word_length: number = 1,
    min_word_frequency: number = 1,
    remove_non_alpha: boolean = true
  ) => {
    setLoading(true);
    setError(null);
    try {
      if (!url) throw new Error('PDF URL is required');
      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_url: url,
          by,
          filter_non_english_words,
          min_word_length,
          min_word_frequency,
          remove_non_alpha
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setHighlights(data.text_chunks || []);
        setRunTimeSeconds(data.run_time_seconds ?? null);
      } else {
        console.error('Failed to load highlights:', response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        setError('Failed to load highlights: ' + (errorText || response.statusText));
      }
    } catch (error: unknown) {
      console.error('Error loading highlights:', error);
      setError('Error loading highlights: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pdfUrl) {
      loadHighlights(
        pdfUrl,
        by,
        filterNonEnglishWords,
        minWordLength,
        minWordFrequency,
        removeNonAlpha
      );
      setDisplayedPdfUrl(pdfUrl);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 font-sans">
      {error && (
        <div className="mb-4 max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-600 hover:text-red-800 font-bold text-lg focus:outline-none"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="mb-6 w-full max-w-4xl mx-auto">
        <div className="flex flex-row items-center gap-4 w-full">
          <input
            type="url"
            value={pdfUrl}
            onChange={e => setPdfUrl(e.target.value)}
            placeholder="Enter PDF URL..."
            className="flex-1 p-4 text-gray-700 bg-white border border-gray-200 rounded-xl shadow-lg outline-none placeholder-gray-500"
            required
          />
          <button
            type="submit"
            disabled={!pdfUrl}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Load
          </button>
        </div>
        {/* Settings row */}
        <div className="flex flex-row items-center gap-6 mt-3 px-1 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <span>By:</span>
            <select
              value={by}
              onChange={e => setBy(e.target.value as 'spans' | 'lines' | 'blocks')}
              className="border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none"
            >
              <option value="spans">Spans</option>
              <option value="lines">Lines</option>
              <option value="blocks">Blocks</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filterNonEnglishWords}
              onChange={e => setFilterNonEnglishWords(e.target.checked)}
              className="accent-blue-600"
            />
            Filter by Word Freq
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={removeNonAlpha}
              onChange={e => setRemoveNonAlpha(e.target.checked)}
              className="accent-blue-600"
            />
            Remove Non-Alpha
          </label>
          <label className="flex items-center gap-2">
            <span>Min Word Length:</span>
            <input
              type="number"
              min={1}
              value={minWordLength}
              onChange={e => setMinWordLength(Number(e.target.value))}
              className="w-14 border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2">
            <span>Min Word Freq (1-8):</span>
            <input
              type="number"
              step={0.1}
              min={0}
              value={minWordFrequency}
              onChange={e => setMinWordFrequency(Number(e.target.value))}
              className="w-16 border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none"
            />
          </label>
        </div>
      </form>
      {displayedPdfUrl && (
        <div className="flex justify-center w-full mt-8">
          <Root source={displayedPdfUrl} className="w-full h-full flex justify-center">
            <div className="bg-white rounded-xl shadow-lg flex flex-row items-stretch" style={{ height: 600, minWidth: 1140 }}>
              <div style={{ width: 800, height: 600, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid #e5e7eb' }}>
                <Pages className="p-4">
                  <Page>
                    <CanvasLayer />
                    <TextLayer />
                    <HighlightLayer className="bg-yellow-200/70" />
                  </Page>
                </Pages>
              </div>
              <HighlightsPanel
                selectedExample={selectedExample}
                setSelectedExample={setSelectedExample}
                highlights={highlights}
                loading={loading}
                runTimeSeconds={runTimeSeconds}
              />
            </div>
          </Root>
        </div>
      )}
    </div>
  );
}