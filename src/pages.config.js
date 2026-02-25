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
import BrandVerification from './pages/BrandVerification';
import CatalogImport from './pages/CatalogImport';
import Confirmation from './pages/Confirmation';
import ContactDetail from './pages/ContactDetail';
import Contacts from './pages/Contacts';
import CustomerProfile from './pages/CustomerProfile';
import DesignConfigurator from './pages/DesignConfigurator';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Loading from './pages/Loading';
import OrderDetail from './pages/OrderDetail';
import OrderHistory from './pages/OrderHistory';
import Pipeline from './pages/Pipeline';
import Product3DManager from './pages/Product3DManager';
import QuoteRequest from './pages/QuoteRequest';
import Results from './pages/Results';
import SalesDashboard from './pages/SalesDashboard';
import SalesQuoteStart from './pages/SalesQuoteStart';
import Settings from './pages/Settings';
import StudentHome from './pages/StudentHome';
import UserTypeSelection from './pages/UserTypeSelection';
import Test from './pages/Test';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BrandVerification": BrandVerification,
    "CatalogImport": CatalogImport,
    "Confirmation": Confirmation,
    "ContactDetail": ContactDetail,
    "Contacts": Contacts,
    "CustomerProfile": CustomerProfile,
    "DesignConfigurator": DesignConfigurator,
    "Home": Home,
    "Landing": Landing,
    "Loading": Loading,
    "OrderDetail": OrderDetail,
    "OrderHistory": OrderHistory,
    "Pipeline": Pipeline,
    "Product3DManager": Product3DManager,
    "QuoteRequest": QuoteRequest,
    "Results": Results,
    "SalesDashboard": SalesDashboard,
    "SalesQuoteStart": SalesQuoteStart,
    "Settings": Settings,
    "StudentHome": StudentHome,
    "UserTypeSelection": UserTypeSelection,
    "Test": Test,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};