import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import WorldSelect from "./pages/WorldSelect";
import WorldEditor from "./pages/WorldEditor";
import WorldView from "./pages/WorldView";
import WorldManage from "./pages/WorldManage";
import NotFound from "./pages/NotFound";
import PovView from "./pages/PovView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WorldSelect />} />
          <Route path="/world/:worldId/edit" element={<WorldEditor />} />
          <Route path="/world/:worldId/view" element={<WorldView />} />
          <Route path="/world/:worldId/manage" element={<WorldManage />} />
          <Route path="/world/:worldId/pov" element={<PovView />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
