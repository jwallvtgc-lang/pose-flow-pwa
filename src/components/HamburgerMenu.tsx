import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const HamburgerMenu = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="p-2">
          <Menu className="w-6 h-6 text-gray-700" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <div className="flex flex-col space-y-4 mt-8">
          <div className="text-lg font-semibold text-gray-800">Menu</div>
          {/* Menu items will be populated in future prompts */}
          <div className="text-gray-600">Menu items coming soon...</div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default HamburgerMenu;