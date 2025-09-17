import AddToHomeScreen from "@/components/AddToHomeScreen";
import { Button } from "@/components/ui/button";
import { posthog } from "@/lib/analytics";

const Index = () => {
  const handleTestEvent = () => {
    posthog.capture('hello_world', {
      timestamp: Date.now(),
      source: 'test_button'
    });
    console.log('PostHog event logged: hello_world');
  };

  return (
    <div className="max-w-[420px] mx-auto px-4 min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div>
            <h1 className="mb-4 text-4xl font-bold text-foreground">SwingSense</h1>
            <p className="text-lg text-muted-foreground leading-tight">AI-powered baseball swing analysis</p>
          </div>
          <Button 
            onClick={handleTestEvent}
            className="h-12 rounded-2xl"
          >
            Test PostHog Event
          </Button>
        </div>
      </div>
      <AddToHomeScreen />
    </div>
  );
};

export default Index;
