import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AppProvider } from "./lib/app-context";
import { isTauri } from "./lib/db";
import { Accounts } from "./pages/Accounts";
import { Commitments } from "./pages/Commitments";
import { Dashboard } from "./pages/Dashboard";
import { FamilyPlan } from "./pages/FamilyPlan";
import { Import } from "./pages/Import";
import { Income } from "./pages/Income";
import { LongTerm } from "./pages/LongTerm";
import { Reports } from "./pages/Reports";
import { Transactions } from "./pages/Transactions";
import { Travel } from "./pages/Travel";

export default function App() {
  if (!isTauri()) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-md">
          <img src="/logo.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
          <h1 className="text-xl font-extrabold">Martins Finança</h1>
          <p className="mt-2 text-sm text-muted">Esta interface roda dentro do aplicativo desktop. Use <code>pnpm app:dev</code> para abrir com o Tauri.</p>
        </div>
      </div>
    );
  }
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="lancamentos" element={<Transactions />} />
            <Route path="contas" element={<Accounts />} />
            <Route path="compromissos" element={<Commitments />} />
            <Route path="rendas" element={<Income />} />
            <Route path="importar" element={<Import />} />
            <Route path="familia" element={<FamilyPlan />} />
            <Route path="viagens" element={<Travel />} />
            <Route path="metas" element={<LongTerm />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  );
}
