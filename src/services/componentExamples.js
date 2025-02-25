import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// Map URLs to example file paths and their require statements
const URL_TO_EXAMPLE_MAP = {
  'input/list/editable/light': {
    path: 'assets/examples/listComponent.js',
    module: require('../../assets/examples/listComponent.js')
  },
  'display/chart.svg/bar/light': {
    path: 'assets/examples/barChart.svg.js',
    module: require('../../assets/examples/barChart.svg.js')
  }
};

// Helper function to read example file content using expo-asset
const readExampleFile = async (assetInfo) => {
  try {
    // Create an asset reference and download it
    const asset = await Asset.fromModule(assetInfo.module).downloadAsync();
    
    // Read the file content using the localUri
    if (asset.localUri) {
      return await FileSystem.readAsStringAsync(asset.localUri);
    } else {
      throw new Error('Asset localUri is undefined');
    }
  } catch (error) {
    console.warn(`Could not read example file ${assetInfo.path}:`, error);
    return `function Component(props) {\n  return React.createElement(RN.Text, null, "Example not available");\n}`;
  }
};

// Helper function to format examples for the prompt
const formatExamples = async () => {
  let result = '';
  
  // Process each example
  for (const [url, assetInfo] of Object.entries(URL_TO_EXAMPLE_MAP)) {
    const name = url.split('/').pop().replace('light', '').trim();
    const source = await readExampleFile(assetInfo);
    
    result += `\n${Object.keys(URL_TO_EXAMPLE_MAP).indexOf(url) + 1}. ${name.charAt(0).toUpperCase() + name.slice(1)} Component (${url}):\n\`\`\`\n${source}\n\`\`\`\n`;
  }
  
  return result;
};

export { URL_TO_EXAMPLE_MAP, formatExamples };
