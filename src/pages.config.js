/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AddressLookup from './pages/AddressLookup';
import ApiDocs from './pages/ApiDocs';
import BlockDetail from './pages/BlockDetail';
import Blocks from './pages/Blocks';
import CustomDashboard from './pages/CustomDashboard';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import LPExplorer from './pages/LPExplorer';
import Leaderboard from './pages/Leaderboard';
import NetworkHealth from './pages/NetworkHealth';
import NetworkMap from './pages/NetworkMap';
import PortfolioTracker from './pages/PortfolioTracker';
import Search from './pages/Search';
import StakingCalculator from './pages/StakingCalculator';
import TokenExplorer from './pages/TokenExplorer';
import TransactionDetail from './pages/TransactionDetail';
import TransactionFlowPage from './pages/TransactionFlowPage';
import Transactions from './pages/Transactions';
import ValidatorAlerts from './pages/ValidatorAlerts';
import ValidatorCompare from './pages/ValidatorCompare';
import ValidatorDetail from './pages/ValidatorDetail';
import Validators from './pages/Validators';
import Watchlist from './pages/Watchlist';
import WhaleWatcher from './pages/WhaleWatcher';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AddressLookup": AddressLookup,
    "ApiDocs": ApiDocs,
    "BlockDetail": BlockDetail,
    "Blocks": Blocks,
    "CustomDashboard": CustomDashboard,
    "Dashboard": Dashboard,
    "Home": Home,
    "LPExplorer": LPExplorer,
    "Leaderboard": Leaderboard,
    "NetworkHealth": NetworkHealth,
    "NetworkMap": NetworkMap,
    "PortfolioTracker": PortfolioTracker,
    "Search": Search,
    "StakingCalculator": StakingCalculator,
    "TokenExplorer": TokenExplorer,
    "TransactionDetail": TransactionDetail,
    "TransactionFlowPage": TransactionFlowPage,
    "Transactions": Transactions,
    "ValidatorAlerts": ValidatorAlerts,
    "ValidatorCompare": ValidatorCompare,
    "ValidatorDetail": ValidatorDetail,
    "Validators": Validators,
    "Watchlist": Watchlist,
    "WhaleWatcher": WhaleWatcher,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};