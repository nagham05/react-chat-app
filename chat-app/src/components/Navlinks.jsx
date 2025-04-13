import React, { useState, useEffect, useRef } from "react";
import logo from '../assets/logo.png'; 
import { RiArrowDownSFill,  RiShutDownLine, RiHomeLine, RiUserLine, RiGroupLine, RiSettingsLine } from "react-icons/ri";
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGroup } from "../context/GroupContext";
import ConfirmationModal from './ConfirmationModal';
import EditProfile from './EditProfile';
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const Navlinks = () => {
  const { currentUser, logout } = useAuth();
  const { groups, setSelectedGroup } = useGroup();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showGroupsDropdown, setShowGroupsDropdown] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowGroupsDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleGroupClick = (group) => {
    setSelectedGroup(group);
    setShowGroupsDropdown(false);
    navigate("/chat");
  };

  return (
    <section className="h-screen w-[100px] bg-[#01AA85] py-4 flex-shrink-0">
      <main className="flex flex-col items-center gap-5 w-full">
        <div className="flex items-start justify-center border-b-1 border-[#ffffffb9] w-full p-4">
          <span className="flex items-center justify-center">
            <img src={logo} className="w-[56px] h-[52px] object-contain bg-white rounded-lg p-2" alt="" />
          </span>
        </div>

        <ul className="flex flex-col items-center gap-5 px-2">
          <li>
            <Link to="/chat">
              <button className="text-[28px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
                <RiHomeLine color="#fff" />
              </button>
            </Link>
          </li>
          <li>
            <button 
              onClick={() => setShowEditProfile(true)}
              className="text-[28px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200"
            >
              <RiUserLine color="#fff" />
            </button>
          </li>
          <li className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowGroupsDropdown(!showGroupsDropdown)}
              className="text-[28px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200"
            >
              <RiGroupLine color="#fff" />
            </button>
            {showGroupsDropdown && (
              <div className="absolute left-full top-0 ml-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700">Your Groups</h3>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {groups.length > 0 ? (
                    groups.map((group) => (
                      <button
                        key={group.id}
                        onClick={() => handleGroupClick(group)}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <div className="w-8 h-8 bg-[#01AA85] rounded-full flex items-center justify-center">
                          <RiGroupLine color="#fff" size={16} />
                        </div>
                        <span className="truncate">{group.name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      No groups yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </li>
         
          <li>
            <button 
              onClick={() => setShowLogoutModal(true)}
              className="text-[28px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200"
            >
              <RiShutDownLine color="#fff" />
            </button>
          </li>
        </ul>
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

      {showEditProfile && (
        <EditProfile
          isOpen={showEditProfile}
          onClose={() => setShowEditProfile(false)}
        />
      )}
    </section>
  );
};

export default Navlinks;