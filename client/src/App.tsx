import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Matches from "./pages/Matches";
import ValueBets from "./pages/ValueBets";
import BetTracker from "./pages/BetTracker";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"}>
        {() => (
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/matches"}>
        {() => (
          <DashboardLayout>
            <Matches />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/value-bets"}>
        {() => (
          <DashboardLayout>
            <ValueBets />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/bet-tracker"}>
        {() => (
          <DashboardLayout>
            <BetTracker />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
