import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/services/api-config';

// Define types for our test results
interface EndpointTestResult {
  status: number | 'Failed';
  ok?: boolean;
  time?: string;
  contentType?: string | null;
  data?: unknown;
  error?: string;
}

interface TestResults {
  baseUrl: string;
  timestamp: string;
  tests: Record<string, EndpointTestResult>;
}

export function ApiDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const [testResults, setTestResults] = useState<TestResults>({
    baseUrl: '',
    timestamp: '',
    tests: {}
  });
  const [isLoading, setIsLoading] = useState(false);

  const testEndpoints = async () => {
    setIsLoading(true);
    setTestResults({
      baseUrl: '',
      timestamp: '',
      tests: {}
    });
    
    const results: TestResults = {
      baseUrl: API_BASE_URL,
      timestamp: new Date().toISOString(),
      tests: {}
    };
    
    // Test endpoints
    const endpointsToTest = [
      '/api/v1/articles', // Main articles endpoint
      '/api/v1/articles?industry=technology', // Filtered articles endpoint
      '/api/v1/articles/search?q=ai', // Search endpoint
      '/api/v1/openapi.json', // OpenAPI documentation
      '/health', // Health check endpoint
      '/' // Root endpoint
    ];
    
    for (const endpoint of endpointsToTest) {
      try {
        const startTime = performance.now();
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        const endTime = performance.now();
        
        let responseData: unknown;
        try {
          responseData = await response.json();
        } catch (e) {
          responseData = await response.text();
        }
        
        results.tests[endpoint] = {
          status: response.status,
          ok: response.ok,
          time: `${(endTime - startTime).toFixed(2)}ms`,
          contentType: response.headers.get('content-type'),
          data: responseData ? (typeof responseData === 'string' && responseData.length > 500 
            ? responseData.substring(0, 500) + '...' 
            : responseData) 
            : null
        };
      } catch (error) {
        results.tests[endpoint] = {
          error: error instanceof Error ? error.message : String(error),
          status: 'Failed'
        };
      }
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-5 left-5 z-50">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsOpen(true)}
          className="bg-background/80 backdrop-blur-sm"
        >
          Debug API
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[80vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-background z-10">
          <CardTitle>API Connection Debugger</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={testEndpoints}
              disabled={isLoading}
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm">
              <strong>Base URL:</strong> {API_BASE_URL}
            </div>
            
            {Object.keys(testResults.tests).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Test Results</h3>
                <div className="text-xs text-muted-foreground">
                  Tested at: {testResults.timestamp}
                </div>
                
                {Object.entries(testResults.tests).map(([endpoint, result]) => (
                  <div key={endpoint} className="border rounded-md p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-sm">{endpoint}</span>
                      <span 
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          result.ok ? 'bg-green-500/20 text-green-600' : 
                          'bg-red-500/20 text-red-600'
                        }`}
                      >
                        {result.status}
                      </span>
                    </div>
                    
                    {result.time && (
                      <div className="text-xs text-muted-foreground">
                        Response time: {result.time}
                      </div>
                    )}
                    
                    {result.error && (
                      <div className="text-xs p-2 bg-red-500/10 rounded border border-red-200 text-red-600 font-mono">
                        {result.error}
                      </div>
                    )}
                    
                    {result.data && (
                      <div className="mt-2">
                        <div className="text-xs font-medium mb-1">Response:</div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                          {typeof result.data === 'object' 
                            ? JSON.stringify(result.data, null, 2)
                            : String(result.data)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium mb-2">Debug Info</h3>
              <pre className="text-xs p-3 bg-muted rounded overflow-auto max-h-32">
                {JSON.stringify({
                  userAgent: navigator.userAgent,
                  host: window.location.host,
                  protocol: window.location.protocol,
                  apiBase: API_BASE_URL
                }, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 