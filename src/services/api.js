import { fetchSSE } from './sseFetch';

import { truncateWithEllipsis } from '../utils/stringUtils';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PROMPT_PREVIEW_LENGTH = 500;  // Characters to show in logs
const RESPONSE_PREVIEW_LENGTH = 500;  // Characters to show in logs

async function* streamCompletion(apiKey, messages, { 
    model = 'anthropic/claude-3.5-sonnet', 
    temperature = 0.7, 
    abortController 
} = {}) {
    if (!apiKey) throw new Error('API key required');
    
    let fullResponse = '';
    console.log(`Stream [${model}] t=${temperature}`);
    console.log(`API Key: ${apiKey ? `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}` : 'missing'}`);
    console.log(`${messages.map(m => `>> ${m.role}: ${truncateWithEllipsis(m.content, PROMPT_PREVIEW_LENGTH)}`).join('\n')}`);

    const requestBody = {
        model,
        messages,
        stream: true,
        temperature
    };

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-Title': 'Voice Assistant Web App',
    };


    const response = await fetchSSE(API_URL, {
        method: 'POST',
        signal: abortController?.signal,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'X-Title': 'Voice Assistant Web App',
        },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
            temperature
        })
    });

    if (!response.ok) {
        console.error(`API fetch error:`, {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries([...response.headers.entries()]),
            timestamp: new Date().toISOString()
        });
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;
    const streamStartTime = Date.now();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunkCount++;
            const chunk = decoder.decode(value, { stream: true });
            
            // Log chunk details every 25 chunks or if it's the first one
            if (chunkCount === 1 || chunkCount % 25 === 0) {
                console.log(`API stream chunk #${chunkCount}:`, {
                    size: value?.length || 0,
                    elapsed: Date.now() - streamStartTime,
                    timestamp: new Date().toISOString()
                });
            }
            
            buffer += chunk;
            const lines = buffer.split('\n');
            
            // Keep the last partial line in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim() || line.startsWith(':')) continue;
                
                const event = line.replace(/^data: /, '');
                if (event === '[DONE]') {
                    yield { content: '', fullResponse, done: true };
                    return;
                }

                try {
                    const data = JSON.parse(event);
                    const content = data.choices?.[0]?.delta?.content;
                    if (!content) continue;
                    
                    fullResponse += content;
                    yield { content, fullResponse, done: false };
                } catch (e) {
                    console.warn('Failed to parse SSE event:', e);
                }
            }
        }
    } catch (err) {
        console.error(`API stream error:`, {
            message: err.message,
            name: err.name,
            type: err.type,
            stack: err.stack?.substring(0, 500),
            chunkCount,
            bufferLength: buffer.length,
            responseLength: fullResponse.length,
            elapsed: Date.now() - streamStartTime,
            timestamp: new Date().toISOString()
        });
        throw err;
    } finally {
        reader.releaseLock();
    }

    console.log(`API stream complete:`, {
        totalChunks: chunkCount,
        responseLength: fullResponse.length,
        totalTime: Date.now() - streamStartTime
    });
    console.log(`<< ${truncateWithEllipsis(fullResponse, RESPONSE_PREVIEW_LENGTH)}`);
}

async function completion(apiKey, messages, { model = 'anthropic/claude-3.5-haiku', temperature = 0.1, max_tokens, abortController } = {}) {
    console.log(`API [${model}] t=${temperature}${max_tokens ? ` max=${max_tokens}` : ''}`);
    console.log(`${messages.map(m => `>> ${m.role}: ${m.content.slice(0, PROMPT_PREVIEW_LENGTH)}...`).join('\n')}`);

    const response = await fetch(API_URL, {
        signal: abortController?.signal,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Voice Assistant Web App'
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            ...(max_tokens && { max_tokens })
        })
    });

    if (!response.ok) {
        const data = await response.json();
        console.error(`API Error [${model}]:`, `${response.status} - ${response.statusText}`);
        throw new Error(`API error ${response.status}: ${JSON.stringify(data)}`);
    }

    const data = await response.json();
    console.log(`<< ${truncateWithEllipsis(data.choices[0].message.content, RESPONSE_PREVIEW_LENGTH)}`);
    
    if (!data.choices?.[0]?.message?.content) {
        throw new Error(`Invalid API response: ${JSON.stringify(data)}`);
    }
    
    return data.choices[0].message.content;
}

export const api = {
    streamCompletion,
    completion
};
