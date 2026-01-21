import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { DepositProvider } from "@/contexts/DepositContext";
import Home from "./pages/Home";
import CryptoPay from "./pages/CryptoPay";
import FiatPayment from "./pages/FiatPayment";
import SelectToken from "./pages/SelectToken";
import Processing from "./pages/Processing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <DepositProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/cryptopay" element={<CryptoPay />} />
              <Route path="/fiatpayment" element={<FiatPayment />} />
              <Route path="/select-token" element={<SelectToken />} />
              <Route path="/processing" element={<Processing />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </BrowserRouter>
        </DepositProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
