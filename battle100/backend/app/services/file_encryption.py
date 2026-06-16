"""
文件加密服务
提供使用 pyzipper 进行 AES-256 加密打包 ZIP 文件的功能，并生成强解压密码。
"""

import pyzipper
import secrets
import string
import tempfile
from pathlib import Path


class FileEncryptionService:
    """文件加密打包服务"""

    @staticmethod
    def generate_password(length: int = 12) -> str:
        """
        生成随机强密码（仅包含字母和数字，便于双击全选复制）
        """
        # 排除容易混淆的字符如 l, o, I, O
        letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
        digits = "23456789"
        
        # 确保密码至少包含字母和数字
        password_chars = [
            secrets.choice(letters),
            secrets.choice(digits)
        ]
        
        # 填充剩余部分
        all_chars = letters + digits
        for _ in range(length - 2):
            password_chars.append(secrets.choice(all_chars))
            
        # 打乱字符顺序
        secrets.SystemRandom().shuffle(password_chars)
        return "".join(password_chars)

    @staticmethod
    async def create_encrypted_zip(
        files: list[tuple[str, bytes]],  # 格式: [(文件名, 文件二进制内容), ...]
        password: str = None,
        encrypt: bool = True
    ) -> tuple[bytes, str | None]:
        """
        创建 ZIP 压缩包，支持 AES-256 加密与普通不加密打包
        返回: (zip字节内容, 解压密码或None)
        """
        if encrypt:
            if not password:
                password = FileEncryptionService.generate_password()
        else:
            password = None

        # 使用临时文件写入打包内容，以避免大文件在内存中占用过多空间
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            if encrypt:
                with pyzipper.AESZipFile(
                    tmp_path, "w",
                    compression=pyzipper.ZIP_DEFLATED,
                    encryption=pyzipper.WZ_AES
                ) as zf:
                    # 设置密码
                    zf.setpassword(password.encode("utf-8"))
                    for filename, content in files:
                        zf.writestr(filename, content)
            else:
                with pyzipper.AESZipFile(
                    tmp_path, "w",
                    compression=pyzipper.ZIP_DEFLATED
                ) as zf:
                    for filename, content in files:
                        zf.writestr(filename, content)

            # 读取打包好的二进制数据
            zip_content = Path(tmp_path).read_bytes()
        finally:
            # 清理临时文件
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass

        return zip_content, password
