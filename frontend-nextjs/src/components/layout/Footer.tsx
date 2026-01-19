import React from 'react';
import Link from 'next/link';
import { Icon } from '../common';

const Footer: React.FC = () => {
    return (
        <footer className="py-8 w-full border-t border-border-color text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-text-secondary px-4">
            <div className="flex items-center gap-2">
                <div className="size-6 bg-primary rounded-full flex items-center justify-center text-background-dark">
                    <Icon name="translate" size="sm" />
                </div>
                <span className="font-bold">KAIYU © 2025</span>
            </div>

            <div className="flex gap-6">
                <Link href="/terms" className="hover:text-primary transition-colors">
                    Điều khoản
                </Link>
                <Link href="/privacy" className="hover:text-primary transition-colors">
                    Bảo mật
                </Link>
                <Link href="/contact" className="hover:text-primary transition-colors">
                    Liên hệ
                </Link>
            </div>
        </footer>
    );
};

export default Footer;
