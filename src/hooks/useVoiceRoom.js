import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analysisPrompt } from '../services/analysis';
import AudioRecord from 'react-native-audio-record';
import { PermissionsAndroid, Platform } from 'react-native';

const options = {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
    audioSource: 6,
    wavFile: 'audio.wav'
};

export function useVoiceRoom({ 
    onTranscription, 
    onError,
    selectedModel, 
    selectedLanguage,
    componentHistory,
    currentHistoryIndex 
}) {
    const [isRecording, setIsRecording] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const ws = useRef(null);
    const [volume, setVolume] = useState(0);

    const cleanup = useCallback(() => {
        if (ws.current) {
            if (ws.current.readyState === WebSocket.OPEN) {
                ws.current.close();
            }
            ws.current = null;
        }
        AudioRecord.stop();
        setIsRecording(false);
        setIsConnecting(false);
        setVolume(0);
    }, []);

    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    useEffect(() => {
        const init = async () => {
            if (Platform.OS === 'android') {
                try {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                        {
                            title: 'Microphone Permission',
                            message: 'App needs access to your microphone',
                            buttonNeutral: 'Ask Me Later',
                            buttonNegative: 'Cancel',
                            buttonPositive: 'OK',
                        },
                    );
                    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                        onError('Microphone permission denied');
                    }
                } catch (err) {
                    console.error('Failed to request permission:', err);
                    onError('Failed to request microphone permission');
                }
            }
            
            AudioRecord.init(options);
            
            AudioRecord.on('data', data => {
                // Decode base64 once
                const binaryString = atob(data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Send to WebSocket if connected
                if (ws.current?.readyState === WebSocket.OPEN) {
                    ws.current.send(bytes.buffer);
                }
                
                // Calculate volume from PCM data
                console.log('Audio data received, length:', data.length);
                const pcmData = new Int16Array(bytes.buffer);
                console.log('PCM data length:', pcmData.length);
                
                let sum = 0;
                for (let i = 0; i < pcmData.length; i++) {
                    sum += Math.abs(pcmData[i]);
                }
                const average = sum / pcmData.length;
                const normalizedVolume = Math.min(average / 32768, 1);
                
                console.log('Volume calculation:', {
                    sum,
                    average,
                    normalizedVolume,
                    isNaN: isNaN(normalizedVolume)
                });
                
                setVolume(normalizedVolume);
            });
        };

        init();
        return () => AudioRecord.stop();
    }, []);

    const startRecording = useCallback(async () => {
        if (isConnecting || isRecording) {
            console.log('Already connecting or recording');
            return;
        }

        try {
            setIsConnecting(true);
            const ultravoxKey = await AsyncStorage.getItem('ultravox_api_key');
            if (!ultravoxKey) {
                throw new Error('Ultravox API key not found');
            }

            const messages = analysisPrompt({ 
                text: '', // Empty since we're starting voice recording
                requestHistory: componentHistory?.map(entry => entry.request) || [],
                currentParams: currentHistoryIndex >= 0 ? componentHistory[currentHistoryIndex]?.params : null
            });

            const response = await fetch('https://api.ultravox.ai/api/calls', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': ultravoxKey
                },
                body: JSON.stringify({
                    model: 'fixie-ai/ultravox',
                    languageHint: selectedLanguage,
                    initialMessages: [
                        {
                            role: 'MESSAGE_ROLE_AGENT',
                            text: messages[0].content
                        },
                        {
                            role: 'MESSAGE_ROLE_USER',
                            text: messages[1].content
                        }
                    ],
                    initialOutputMedium: 'MESSAGE_MEDIUM_TEXT',
                    medium: { 
                        serverWebSocket: {
                            inputSampleRate: 16000,
                            outputSampleRate: 16000
                        }
                    },
                    firstSpeaker: 'FIRST_SPEAKER_USER',
                    transcriptOptional: false,
                    recordingEnabled: false
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Ultravox API error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                throw new Error(`Failed to create call: ${response.status} ${response.statusText}\n${errorText}`);
            }

            const { joinUrl } = await response.json();
            cleanup();
            
            ws.current = new WebSocket(joinUrl);
            
            ws.current.onopen = () => {
                setIsConnecting(false);
                setIsRecording(true);
                AudioRecord.start();
            };

            ws.current.onmessage = (event) => {
                if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
                    console.log('Received message after WebSocket closed');
                    return;
                }
                const msg = JSON.parse(event.data);
                
                // Log all messages, but only length for audio data
                if (msg.type === 'audio') {
                    console.log('Received audio message:', {
                        type: msg.type,
                        dataLength: msg.data?.length || 0
                    });
                } else {
                    console.log('Received message:', msg);
                }

                // Handle agent transcripts
                if (msg.type === "transcript" && msg.role === "agent" && msg.final && msg.text) {
                    try {
                        // Parse the JSON response from the agent
                        const analysis = JSON.parse(msg.text);
                        // Stop recording first since we have the complete analysis
                        stopRecording();
                        // Then trigger component generation
                        onTranscription?.(analysis);
                    } catch (error) {
                        console.error('Error parsing transcript:', error);
                        onError?.('Failed to parse transcript');
                        stopRecording();
                    }
                }
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', {
                    error,
                    errorStack: error.stack || new Error().stack,
                    wsState: ws.current?.readyState,
                    wsUrl: ws.current?.url
                });
                onError?.('Connection error');
                stopRecording();
            };

            ws.current.onclose = () => {
                console.log('WebSocket connection closed');
                cleanup();
            };

        } catch (error) {
            console.error('Error starting recording:', error);
            onError?.(error.message);
            cleanup();
        }
    }, [componentHistory, currentHistoryIndex, selectedLanguage]);

    const stopRecording = useCallback(() => {
        cleanup();
    }, [cleanup]);

    const cancelRecording = useCallback(() => {
        cleanup();
    }, [cleanup]);

    return {
        isRecording,
        volume,
        startRecording,
        stopRecording,
        cancelRecording
    };
}
