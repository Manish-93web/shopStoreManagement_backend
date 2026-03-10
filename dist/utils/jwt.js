import jwt from 'jsonwebtoken';
export const generateAccessToken = (user) => {
    return jwt.sign({
        id: user._id,
        role: user.role,
        storeId: user.storeId || (user.stores && user.stores[0])
    }, process.env.JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRE || '7d') });
};
export const generateRefreshToken = (user) => {
    return jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: (process.env.REFRESH_TOKEN_EXPIRE || '30d') });
};
