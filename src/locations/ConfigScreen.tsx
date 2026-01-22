import { useEffect, useState } from 'react';
import { ConfigAppSDK } from '@contentful/app-sdk';
import { 
  Heading, 
  Flex, 
  Table, 
  TableHead, 
  TableBody, 
  TableRow, 
  TableCell, 
  Spinner,
  Note,
  Text,
  Box,
  Badge
} from '@contentful/f36-components';
import { useSDK } from '@contentful/react-apps-toolkit';

interface WorkflowStep {
  id: string;
  name: string;
}

interface WorkflowDefinition {
  sys: {
    id: string;
  };
  name: string;
  steps: WorkflowStep[];
}

const ConfigScreen = () => {
  const sdk = useSDK<ConfigAppSDK>();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Register configuration handler
    sdk.app.onConfigure(() => {
      return {
        parameters: {},
      };
    });

    // Signal that the app is ready to be displayed
    sdk.app.setReady();
  }, [sdk]);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use the CMA to fetch workflow definitions
        const response = await sdk.cma.workflowDefinition.getMany({});
        
        const workflowData: WorkflowDefinition[] = response.items.map((item: any) => ({
          sys: { id: item.sys.id },
          name: item.name,
          steps: item.steps?.map((step: any) => ({
            id: step.id,
            name: step.name,
          })) || [],
        }));

        setWorkflows(workflowData);
      } catch (err: any) {
        console.error('Error fetching workflows:', err);
        setError(err.message || 'Failed to fetch workflow definitions');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkflows();
  }, [sdk.cma]);

  if (loading) {
    return (
      <Flex 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center"
        style={{ minHeight: '300px', padding: '40px' }}
      >
        <Spinner size="large" />
        <Text marginTop="spacingM">Loading workflow definitions...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex 
        flexDirection="column" 
        style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}
      >
        <Note variant="negative" title="Error loading workflows">
          {error}
        </Note>
      </Flex>
    );
  }

  return (
    <Flex 
      flexDirection="column" 
      style={{ maxWidth: '900px', margin: '40px auto', padding: '0 20px' }}
    >
      <Heading marginBottom="spacingL">Workflow Definitions</Heading>
      
      {workflows.length === 0 ? (
        <Note variant="warning">
          No workflow definitions found in this environment.
        </Note>
      ) : (
        workflows.map((workflow) => (
          <Box 
            key={workflow.sys.id} 
            marginBottom="spacingXl"
            style={{ 
              border: '1px solid #e5e5e5', 
              borderRadius: '4px',
              overflow: 'hidden'
            }}
          >
            <Box 
              padding="spacingM" 
              style={{ backgroundColor: '#f7f9fa', borderBottom: '1px solid #e5e5e5' }}
            >
              <Flex justifyContent="space-between" alignItems="center">
                <Heading as="h2" marginBottom="none">
                  {workflow.name}
                </Heading>
                <Badge variant="secondary">ID: {workflow.sys.id}</Badge>
              </Flex>
            </Box>
            
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Step Name</TableCell>
                  <TableCell>Step ID</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workflow.steps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Text fontColor="gray500">No steps defined</Text>
                    </TableCell>
                  </TableRow>
                ) : (
                  workflow.steps.map((step, index) => (
                    <TableRow key={step.id}>
                      <TableCell>
                        <Flex alignItems="center" gap="spacingXs">
                          <Badge variant="primary">{index + 1}</Badge>
                          <Text>{step.name}</Text>
                        </Flex>
                      </TableCell>
                      <TableCell>
                        <Text fontFamily="monospace" fontSize="fontSizeS">
                          {step.id}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Box>
        ))
      )}
    </Flex>
  );
};

export default ConfigScreen;
