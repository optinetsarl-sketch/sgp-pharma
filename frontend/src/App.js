import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/i18n";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Suppliers from "@/pages/Suppliers";
import Reception from "@/pages/Reception";
import Stock from "@/pages/Stock";
import POS from "@/pages/POS";
import SalesHistory from "@/pages/SalesHistory";
import Losses from "@/pages/Losses";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import AuditLog from "@/pages/AuditLog";
import Orders from "@/pages/Orders";
import Pharmacies from "@/pages/Pharmacies";
import Documentation from "@/pages/Documentation";
import PharmacySetup from "@/pages/PharmacySetup";

function Shell({ children }) { return <Layout>{children}</Layout>; }

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Shell><Dashboard /></Shell></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist", "cashier", "operator"]}><Shell><POS /></Shell></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist", "cashier"]}><Shell><SalesHistory /></Shell></ProtectedRoute>} />
            <Route path="/sales-history" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist", "cashier"]}><Shell><SalesHistory /></Shell></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Shell><Products /></Shell></ProtectedRoute>} />
            <Route path="/stock" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist", "storekeeper", "operator"]}><Shell><Stock /></Shell></ProtectedRoute>} />
            <Route path="/reception" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist", "storekeeper"]}><Shell><Reception /></Shell></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist", "storekeeper"]}><Shell><Orders /></Shell></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist", "storekeeper"]}><Shell><Suppliers /></Shell></ProtectedRoute>} />
            <Route path="/losses" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist"]}><Shell><Losses /></Shell></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist"]}><Shell><Reports /></Shell></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={["super_admin", "admin"]}><Shell><Users /></Shell></ProtectedRoute>} />
            <Route path="/pharmacies" element={<ProtectedRoute roles={["super_admin", "admin"]}><Shell><Pharmacies /></Shell></ProtectedRoute>} />
            <Route path="/setup" element={<ProtectedRoute roles={["super_admin", "admin"]}><Shell><PharmacySetup /></Shell></ProtectedRoute>} />
            <Route path="/pharmacy-setup" element={<ProtectedRoute roles={["super_admin", "admin"]}><Shell><PharmacySetup /></Shell></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute roles={["super_admin", "admin", "pharmacist"]}><Shell><AuditLog /></Shell></ProtectedRoute>} />
            <Route path="/documentation" element={<ProtectedRoute roles={["super_admin", "admin"]}><Shell><Documentation /></Shell></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
