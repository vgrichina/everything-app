# Voice-Driven React Native Component Generator

An AI-powered voice assistant that generates and modifies React Native components through natural language commands. Built with Expo and OpenRouter API (Claude).

## Features

- 🎙️ Voice commands to generate UI components
- ⚡ Real-time component generation and preview
- 🔄 Component modification through natural language
- 📱 Cross-platform (iOS/Android) support
- 💾 Persistent component storage
- 🧪 Debug generation interface for testing

## Installation

### Prerequisites

- Node.js
- Yarn or npm
- Expo CLI
- Bun (for evaluation scripts)
- iOS/Android development environment

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/voice-assistant.git
cd voice-assistant
```

2. Install dependencies:
```bash
yarn install
```

3. Configure environment:
- Set up OpenRouter API key in app settings
- Configure required permissions:
  - Microphone access
  - Speech recognition
  - Internet access

### Running the App

This app requires a native build due to dependencies on native modules (speech recognition, etc). It cannot run in Expo Go.

```bash
# Build and run on iOS simulator/device
yarn ios

# Build and run on Android emulator/device
yarn android

# Clean build cache if needed
yarn clean
```

Note: Web platform support is limited due to native module dependencies.

## How It Works

### 1. Request Analysis

The system uses a structured URL-based widget specification system:

```
category/type/style/theme?with_feature=yes&params=name:type
```

Categories:
- `display`: Information display (clock, weather, calendar)
- `input`: User data entry (lists, notes, forms)
- `interactive`: User actions (timer, player, calculator)
- `feedback`: System responses (progress, loading, alerts)
- `media`: Rich content (images, video, audio)

Features flags (with_*):
- `with_controls`: Play/pause/reset controls
- `with_dates`: Date/time handling
- `with_progress`: Progress tracking
- `with_checkboxes`: Checkbox toggles
- `with_hourly`: Hourly breakdown

Example:
```
display/weather/forecast/light?with_daily=yes&params=location:caption,unit:caption,date:string,days:integer
```

### 2. Parameter Types

The system supports strongly-typed parameters:

Text Types:
- `caption`: Short labels (1-3 words)
- `title`: Headings with context (3-7 words)
- `sentence`: Single complete thought
- `paragraph`: Multiple sentences
- `story`: Long-form content
- `url`: Web URLs

Number Types:
- Basic: `integer`, `decimal`
- Semantic: `size`, `duration`, `count`, `percentage`, `interval`, `goal`, `currency`

Arrays:
- `caption[]`: Lists of short items
- `sentence[]`: Lists of tasks/notes
- `{text:string,done:boolean}[]`: Basic todo items
- `{text:string,done:boolean,time:string}[]`: Scheduled todo items
- `{text:string,selected:boolean,value:string}[]`: Selection list items

## Technical Architecture

### Core Services

`analysis.js`:
- Analyzes user requests using Claude
- Determines intent (new/modify)
- Generates widget URLs and parameters
- Maintains request history context

`api.js`:
- Handles OpenRouter API communication
- Supports both streaming and non-streaming completions
- Includes detailed request/response logging
- Handles SSE for real-time responses

`componentGenerator.js`:
- Generates React Native components
- Validates component structure
- Tests component rendering
- Handles component scope and dependencies

`widgetStorage.js`:
- Manages AsyncStorage-based component cache
- Stores components by widget URL
- Maintains version history with timestamps

## Platform-Specific Configuration

### iOS
- Bundle Identifier: `com.voiceassistant.app`
- Required Permissions:
  - Microphone Usage
  - Speech Recognition
  - Background Audio Mode

### Android
- Package: `com.voiceassistant.app`
- Required Permissions:
  - RECORD_AUDIO
  - INTERNET
- Build Configuration:
  - Kotlin Version: 1.8.10
  - Compile SDK: 35
  - Target SDK: 34
  - Build Tools: 34.0.0

## Evaluation System

The app includes two evaluation scripts for testing the AI components:

### Analysis Evaluation

```bash
bun scripts/evaluate-analysis.js [model]
# Default: anthropic/claude-3.5-sonnet
```

Example test case:
```json
{
    "request": "What time is it?",
    "expected": {
        "intent": "new",
        "widgetUrl": "display/clock/digital/light?params=format:caption,size:integer",
        "params": {
            "format": "HH:mm",
            "size": 48
        }
    }
}
```

### Component Generation Evaluation

```bash
bun scripts/evaluate-generation.js [model]
# Default: anthropic/claude-3.5-sonnet
```

Reports are saved in the `evaluations/` directory with filenames:
- `analysis-[date]-[model].md`
- `evaluation-[date]-[model].md`

## Dependencies

Key packages:
- `expo` ~52.0.0
- `@expo/vector-icons` ^14.0.0
- `expo-av` ~15.0.2
- `expo-clipboard` ~7.0.1
- `expo-file-system` ~18.0.7
- `expo-haptics` ~14.0.1
- `expo-image-picker` ~16.0.4
- `expo-linking` ~7.0.0
- `expo-location` ~18.0.5
- `expo-media-library` ~17.0.5
- `expo-notifications` ~0.29.12
- `expo-sensors` ~14.0.2
- `expo-sharing` ~13.0.1
- `react` 18.3.1
- `react-native` 0.76.6
- `@react-native-async-storage/async-storage` 1.23.1
- `react-native-gesture-handler` ~2.20.2
- `react-native-reanimated` ~3.16.1
- `react-native-audio-record` ^0.2.2
- `@expo/vector-icons` ^14.0.4
- `partial-json` ^0.1.7

For full list of dependencies, see `package.json`.

## Development Notes

- Uses Expo Router for navigation
- Supports TypeScript
- Includes custom Expo plugins for speech recognition
- Configured for both light and dark mode support

## License

MIT License

## TestFlight Builds with Test API Keys

For TestFlight builds, you may want to include test API keys so testers don't need to enter their own keys.
This app supports injecting test API keys at build time using the following process:

1. Create a `.env` file with your test API keys:

```bash
# Copy the example file
cp .env.example .env

# Edit the .env file with your test keys
# TEST_ULTRAVOX_KEY=your-ultravox-test-key
# TEST_OPENROUTER_KEY=your-openrouter-test-key
```

2. Inject the test API keys from the .env file:

```bash
# This reads from .env and creates a gitignored secrets file
yarn inject-keys
```

3. Prebuild the iOS project:

```bash
yarn expo prebuild --platform ios --clean
```

4. Open the project in Xcode:

```bash
open ios/VoiceAssistant.xcworkspace
```

5. Build and archive in Xcode, then submit to TestFlight.

6. After your build is complete, you may want to remove the secrets file (optional):

```bash
rm src/config/buildTimeSecrets.js
```

The secrets file is already in .gitignore, so it won't be committed to the repository.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
