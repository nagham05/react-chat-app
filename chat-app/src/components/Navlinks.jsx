import React from 'react';
import logo from '../assets/logo.png'; 
import { RiArrowDownSFill, RiBardLine, RiChatAiFill, RiChatAiLine, RiFile4Line, RiFolderUserLine, RiNotificationLine, RiShutDownLine } from "react-icons/ri";
import { Link } from 'react-router-dom';

const Navlinks = () => {
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
            <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
              <RiChatAiLine color="#fff" />
            </button>
          </li>
          <li>
            <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
              <RiFolderUserLine color="#fff" />
            </button>
          </li>
          <li>
            <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
              <RiNotificationLine color="#fff" />
            </button>
          </li>
          <li>
            <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
              <RiFile4Line color="#fff" />
            </button>
          </li>
          <li>
            <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
              <RiBardLine color="#fff" />
            </button>
          </li>
          <li>
            <Link to="/login">
                <button className="lg:text-[28px] text-[24px] cursor-pointer p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
                <RiShutDownLine color="#fff" />
                </button>
            </Link>
          </li>
        </ul>
        <button className="block lg:hidden lg:text-[28px] text-[24px] p-2 hover:bg-[#01AA85]/70 rounded-full transition duration-200">
          <RiArrowDownSFill color="#fff" />
        </button>
      </main>
    </section>
  );
};

export default Navlinks;