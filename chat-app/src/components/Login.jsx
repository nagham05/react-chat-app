import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [user, setUser] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUser({
      ...user,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(user.email, user.password);
      navigate('/chat');
    } catch (error) {
      setError('Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className='flex flex-col justify-center items-center h-[100vh] background-image'>
      <div className='bg-white shadow-lg p-5 rounded-xl h-[27rem] w-[20rem] flex flex-col justify-center items-center'>
        <div className='mb-10'>
          <h1 className='text-center text-[28px] font-bold'>Sign In</h1>
          <p className='text-center text-sm text-gray-400'>Welcome back, login to continue</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 w-full" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

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

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#01AA85] focus:ring-[#01AA85] border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link to="/reset-password" className="font-medium text-[#01AA85] hover:text-[#018a6d]">
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div className="w-full">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#01aa85] text-white w-full p-2 rounded-md font-medium flex items-center gap-2 justify-center disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center text-gray-400 text-sm">
            <button>Don't have an account? <Link to="/register" className="text-[#01aa85] hover:underline">Sign up</Link></button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;
