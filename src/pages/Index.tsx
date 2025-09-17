import AddToHomeScreen from "@/components/AddToHomeScreen";

const Index = () => {
  return (
    <div className="max-w-[420px] mx-auto px-4 min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">SwingSense</h1>
          <p className="text-lg text-muted-foreground leading-tight">AI-powered baseball swing analysis</p>
        </div>
      </div>
      <AddToHomeScreen />
    </div>
  );
};

export default Index;
