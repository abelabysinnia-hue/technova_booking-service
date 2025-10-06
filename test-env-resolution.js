// Test script to verify environment variable resolution
require('dotenv').config();

function buildUrlFromTemplate(template, params) {
  if (!template) return null;
  
  // First resolve environment variables in the template
  let resolvedTemplate = template;
  const envVarRegex = /\$\{([^}]+)\}/g;
  let match;
  while ((match = envVarRegex.exec(template)) !== null) {
    const envVarName = match[1];
    const envVarValue = process.env[envVarName];
    if (envVarValue) {
      resolvedTemplate = resolvedTemplate.replace(match[0], envVarValue);
    }
  }
  
  // Then replace template parameters
  return Object.keys(params || {}).reduce(
    (acc, key) => acc.replace(new RegExp(`{${key}}`, 'g'), encodeURIComponent(String(params[key]))),
    resolvedTemplate
  );
}

console.log('Environment Variables:');
console.log('AUTH_BASE_URL:', process.env.AUTH_BASE_URL);
console.log('PASSENGER_LOOKUP_URL_TEMPLATE:', process.env.PASSENGER_LOOKUP_URL_TEMPLATE);
console.log('DRIVER_LOOKUP_URL_TEMPLATE:', process.env.DRIVER_LOOKUP_URL_TEMPLATE);

console.log('\nURL Resolution Test:');
const passengerTemplate = process.env.PASSENGER_LOOKUP_URL_TEMPLATE || '${AUTH_BASE_URL}/passengers/{id}';
const driverTemplate = process.env.DRIVER_LOOKUP_URL_TEMPLATE || '${AUTH_BASE_URL}/drivers/{id}';

console.log('Passenger Template:', passengerTemplate);
console.log('Resolved Passenger URL:', buildUrlFromTemplate(passengerTemplate, { id: '2' }));

console.log('Driver Template:', driverTemplate);
console.log('Resolved Driver URL:', buildUrlFromTemplate(driverTemplate, { id: '2' }));