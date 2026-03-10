import jwt from 'jsonwebtoken';

export const generateAccessToken = (user: any): string => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role,
            storeId: user.storeId || (user.stores && user.stores[0])
        },
        process.env.JWT_SECRET as string,
        { expiresIn: (process.env.JWT_EXPIRE || '7d') as any }
    );
};

export const generateRefreshToken = (user: any): string => {
    return jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN_SECRET as string,
        { expiresIn: (process.env.REFRESH_TOKEN_EXPIRE || '30d') as any }
    );
};
