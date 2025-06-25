import * as React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { OrderBook } from "@/components/dashboard/OrderBook";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { AccountOverview } from "@/components/dashboard/AccountOverview";
import { OrderForm } from "@/components/dashboard/OrderForm";
import { OpenOrdersTable } from "@/components/dashboard/OpenOrdersTable";
import ApiKeyModal from "@/components/dashboard/ApiKeyModal";
import { useApiKeys } from "@/hooks/use-api-keys";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = React.useState(false);
  const { hasKeys } = useApiKeys();

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onApiKeyModalOpen={() => setIsApiKeyModalOpen(true)} />
        
        <main className="flex-1 overflow-y-auto">
          {!hasKeys ? (
            // Show API key connection prompt if no keys are available
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md p-6 bg-card-bg rounded-lg border border-[#3A3A3A]">
                <div className="bg-blue-500 bg-opacity-10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Connect Your Coinbase Account</h2>
                <p className="text-gray-400 mb-4">
                  To use the Coinbase trading dashboard, you need to authorize access to your Coinbase account. This secure OAuth connection allows you to view and manage your trading data.
                </p>
                <Button
                  className="bg-[#0052FF] hover:bg-blue-600 text-white"
                  onClick={() => setIsApiKeyModalOpen(true)}
                >
                  Connect with Coinbase
                </Button>
              </div>
            </div>
          ) : (
            // Show dashboard content when API keys are available
            <div className="grid grid-cols-12 gap-4 p-4">
              {/* Price Chart */}
              <PriceChart />
              
              {/* Order Book and Recent Trades */}
              <div className="col-span-12 lg:col-span-4 grid grid-rows-2 gap-4">
                <OrderBook />
                <RecentTrades />
              </div>
              
              {/* Account Overview */}
              <AccountOverview />
              
              {/* Order Form */}
              <OrderForm />
              
              {/* Open Orders */}
              <OpenOrdersTable />
            </div>
          )}
        </main>
        
        {/* API Key Modal */}
        <ApiKeyModal 
          isOpen={isApiKeyModalOpen} 
          onClose={() => setIsApiKeyModalOpen(false)}
        />
      </div>
    </>
  );
}
