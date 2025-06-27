// src/app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { CanvasLayer, HighlightLayer, Page, Pages, Root, TextLayer, usePdfJump, usePdf } from "@anaralabs/lector";
import "@/lib/setup";
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

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
}: {
  selectedExample: number | null;
  setSelectedExample: (index: number) => void;
  highlights: TextChunk[];
  loading: boolean;
}) {
  const setHighlight = usePdf(state => state.setHighlight);
  const { jumpToHighlightRects } = usePdfJump();

  const handleExampleClick = (example: TextChunk, index: number) => {
    setSelectedExample(index);
    const highlightRect = textChunkToHighlightRect(example);
    setHighlight([highlightRect]);
    jumpToHighlightRects([highlightRect], "pixels");
  };

  return (
    <div style={{ width: 340, height: 600, borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-black">Transcript</h2>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading transcript...</div>
        ) : (
          <List
            height={540}
            itemCount={highlights.length}
            itemSize={56}
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

  const loadHighlights = async (url?: string, by: "spans" | "lines" | "blocks" = "blocks") => {
    setLoading(true);
    try {
      if (!url) throw new Error('PDF URL is required');
      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_url: url, by }),
      });
      if (response.ok) {
        const data = await response.json();
        setHighlights(data.text_chunks || []);
      } else {
        console.error('Failed to load highlights:', response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error loading highlights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pdfUrl) {
      loadHighlights(pdfUrl);
      setDisplayedPdfUrl(pdfUrl);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 font-sans">
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
              />
            </div>
          </Root>
        </div>
      )}
    </div>
  );
}