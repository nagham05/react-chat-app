import React, { useState } from 'react';
import logo from '../assets/logo.png'; 
import { RiArrowDownSFill, RiBardLine, RiChatAiFill, RiChatAiLine, RiFile4Line, RiFolderUserLine, RiNotificationLine, RiShutDownLine, RiHomeLine, RiUserLine, RiGroupLine, RiSettingsLine } from "react-icons/ri";
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmationModal from './ConfirmationModal';

const Navlinks = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <section className="h-screen w-[100px] bg-[#01AA85] py-4 flex-shrink-0">
      <main className="flex flex-col items-center gap-5 w-full">
        <div className="flex items-start justify-center border-b-1 border-[#ffffffb9] w-full p-4">
          <span className="flex items-center justify-center">
            <img src={logo} className="w-[56px] h-[52px] object-contain bg-white rounded-lg p-2" alt="" />
          </span>
        </div>

        <ul className="flex lg:flex-col flex-row items-center gap-2 md:gap-5 px-2 md:px-0">
          <li>
            <Link to="/chat">
              <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
                <RiHomeLine color="#fff" />
              </button>
            </Link>
          </li>
          <li>
            <Link to="/profile">
              <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
                <RiUserLine color="#fff" />
              </button>
            </Link>
          </li>
          <li>
            <Link to="/groups">
              <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
                <RiGroupLine color="#fff" />
              </button>
            </Link>
          </li>
          <li>
            <Link to="/settings">
              <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
                <RiSettingsLine color="#fff" />
              </button>
            </Link>
          </li>
          <li>
            <button 
              onClick={() => setShowLogoutModal(true)}
              className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200"
            >
              <RiShutDownLine color="#fff" />
            </button>
          </li>
        </ul>
        <button className="block lg:hidden lg:text-[28px] text-[24px] p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
          <RiArrowDownSFill color="#fff" />
        </button>
      </main>

      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        confirmButtonClass="bg-red-500 hover:bg-red-600"
      />
    </section>
  );
};

export default Navlinks;