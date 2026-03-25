import pandas as pd
import datetime

def save_to_excel(df: pd.DataFrame, file_path, file_name: str):
    now = datetime.datetime.now()
    now_str = now.strftime("%Y%m%d_%H%M%S")
    complete_file_path = f'{file_path}/{now_str}_{file_name}.xlsx'
    df.to_excel(complete_file_path, index=False)

def load_from_excel(file_path: str) -> pd.DataFrame:
    return pd.read_excel(file_path)