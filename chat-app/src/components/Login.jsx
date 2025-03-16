import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [user, setUser] = useState({
    email: '',
    password: ''
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser({
      ...user,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(user);
    setUser({
      email: '',
      password: ''
    });

    navigate('/chat');
  };

  return (
    <section className='flex flex-col justify-center items-center h-[100vh] background-image'>
      <div className='bg-white shadow-lg p-5 rounded-xl h-[27rem] w-[20rem] flex flex-col justify-center items-center'>
        <div className='mb-10'>
          <h1 className='text-center text-[28px] font-bold'>Sign In</h1>
          <p className='text-center text-sm text-gray-400'>Welcome back, login to continue</p>
        </div>

        <div className="w-full">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <input
              type="email"
              name="email"
              value={user.email}
              onChange={handleChange}
              className="border border-green-200 w-full p-2 rounded-md bg-[#01aa851d] text-[#004939f3] mb-3 font-medium outline-none"
              placeholder="Email"
              required
            />

            <input
              type="password"
              name="password"
              value={user.password}
              onChange={handleChange}
              className="border border-green-200 w-full p-2 rounded-md bg-[#01aa851d] text-[#004939f3] mb-3 font-medium outline-none"
              placeholder="Password"
              required
            />

            <div className="w-full">
              <button
                type="submit"
                className="bg-[#01aa85] text-white w-full p-2 rounded-md font-medium flex items-center gap-2 justify-center"
              >
                Login
              </button>
            </div>
          </form>

          <div className="mt-5 text-center text-gray-400 text-sm">
            <button>Don't have an account? <a href="/register">Sign up</a></button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;
