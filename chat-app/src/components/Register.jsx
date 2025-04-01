import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [user, setUser] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signup } = useAuth();

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
      await signup(user.email, user.password, user.name);
      navigate('/chat');
    } catch (error) {
      setError('Failed to create an account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className='flex flex-col justify-center items-center h-[100vh] background-image'>
      <div className='bg-white shadow-lg p-5 rounded-xl h-[27rem] w-[20rem] flex flex-col justify-center items-center'>
        <div className='mb-10'>
          <h1 className='text-center text-[28px] font-bold'>Signup</h1>
          <p className='text-center text-sm text-gray-400'>Welcome, create an account to continue</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 w-full" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="w-full">
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <input 
              type="text" 
              name='name'
              value={user.name}
              onChange={handleChange}
              className='border border-green-200 w-full p-2 rounded-md bg-[#01aa851d] text-[#004939f3] mb-3 font-medium outline-none' 
              placeholder='Full name'
              required
            />
            <input 
              type="email" 
              name='email'
              value={user.email}
              onChange={handleChange}
              className='border border-green-200 w-full p-2 rounded-md bg-[#01aa851d] text-[#004939f3] mb-3 font-medium outline-none' 
              placeholder='Email'
              required
            />
            <input 
              type="password" 
              name='password'
              value={user.password}
              onChange={handleChange}
              className='border border-green-200 w-full p-2 rounded-md bg-[#01aa851d] text-[#004939f3] mb-3 font-medium outline-none' 
              placeholder='Password'
              required
            />
            <div className="w-full">
              <button 
                type='submit' 
                disabled={loading}
                className='bg-[#01aa85] text-white w-full p-2 rounded-md font-medium flex items-center gap-2 justify-center disabled:opacity-50'
              >
                {loading ? 'Creating Account...' : 'Signup'}
              </button>
            </div>
          </form>

          <div className='mt-5 text-center text-gray-400 text-sm'>
            <button>Already have an account? <Link to="/login" className="text-[#01aa85] hover:underline">Sign in</Link></button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Register;
