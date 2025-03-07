# Unified History Model

This document explains the unified history model introduced in the application, replacing the previous dual history approach.

## Overview

The unified history model combines conversation history and component history into a single data structure where each entry contains both the user's transcription (what they said) and the resulting generated component (what was created in response).

## Data Structure

Each history entry follows this structure:

```javascript
{
  id: "unique-id-123",
  // Transcript data
  transcript: "Create a bar chart showing sales by quarter",
  intent: "new",
  // Component data  
  component: {
    code: "// React component code here...",
    widgetUrl: "chart-123",
    params: { type: "bar", data: [...] }
  },
  // Metadata
  timestamp: 1647889231
}
```

This unified model provides several advantages:
- Clear 1:1 relationship between user requests and generated components
- Single source of truth for history navigation
- Simplified persistence
- More intuitive mental model for application state

## Service API

The `componentHistoryService` provides these core functions:

```javascript
// Add a new entry to history
componentHistoryService.addToHistory(component, analysis);

// Navigate through history
componentHistoryService.goBack();
componentHistoryService.goForward();
componentHistoryService.setCurrentIndex(index);

// Get current state
componentHistoryService.getCurrent();         // Full entry
componentHistoryService.getCurrentComponent(); // Just component part (legacy)

// Conversation management
componentHistoryService.switchConversation(id);
componentHistoryService.createNewConversation();
componentHistoryService.getAllConversations();
componentHistoryService.deleteConversation(id);
```

## React Integration

The unified `useAssistantState` hook provides React components with access to both assistant state and history. It follows our standard service-hook pattern described in [SERVICE_HOOK_PATTERN.md](SERVICE_HOOK_PATTERN.md).

```javascript
const {
  // Assistant state
  status,
  volume,
  transcript,
  partialTranscript,
  error,
  callActive,
  
  // History state
  history,                // All history entries
  currentHistoryIndex,    // Current position
  current,                // Current entry (transcript + component)
  currentComponent,       // Just the component (legacy support)
  activeConversationId,   // Current conversation ID
  
  // Assistant actions
  startPTT,
  stopPTT,
  abortGeneration,
  
  // History navigation
  navigateBack,
  navigateForward,
  goBack,                 // Alias for navigateBack
  goForward,              // Alias for navigateForward
  
  // Conversation management
  switchConversation,
  createNewConversation,
  clearHistory,
  // ...other methods
} = useAssistantState();
```

The hook consolidates all assistant and history functionality into a single interface, eliminating the need for separate hooks. This simplifies component code and avoids potential state synchronization issues.

### State Management Architecture

```
┌─────────────────────┐
│                     │
│     Components      │
│                     │
└─────────┬───────────┘
          │ Uses
          ▼
┌─────────────────────┐    ┌─────────────────────┐
│                     │    │                     │
│  useAssistantState  │◄───┤  AssistantService   │
│   (Unified Hook)    │    │                     │
└─────────┬───────────┘    └─────────────────────┘
          │ Accesses              ▲
          ▼                      │ Calls
┌─────────────────────┐    ┌─────────────────────┐
│                     │    │                     │
│ componentHistory    │◄───┤    audioSession     │
│      Service        │    │                     │
└─────────────────────┘    └─────────────────────┘
```

The hook uses a memoized return value to ensure that React components only re-render when the specific values they consume have changed. This optimization happens at the hook level, eliminating the need for consumers to implement their own memoization.

## Legacy Compatibility

Previously, the service provided backward compatibility APIs. With our recent architecture refactoring, these legacy methods have been removed to simplify the codebase:

```javascript
// REMOVED Legacy component history methods
componentHistoryService.getComponents();      // Replaced with getState().history
componentHistoryService.back();               // Replaced with goBack()
componentHistoryService.forward();            // Replaced with goForward()
componentHistoryService.setComponentIndex();  // Replaced with setCurrentIndex()
```

All application code has been updated to use the new unified API methods. This simplifies the service implementation and ensures a consistent interface throughout the codebase.

## Implementation Notes

1. History is stored in conversationStorage with the unified format
2. Each component has a widgetUrl that's used as a key for widgetStorage
3. The history maintains application flow through component<->transcript pairs
4. Navigation affects both component and transcript simultaneously
5. All UI components access history through the unified useAssistantState hook