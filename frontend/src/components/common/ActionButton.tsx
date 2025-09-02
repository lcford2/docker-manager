import { Button, ButtonProps } from "@mui/joy";
import React from "react";

interface ActionButtonProps extends Omit<ButtonProps, "action"> {
  loading?: boolean;
  action: string;
  onActionClick: () => void;
  confirmationRequired?: boolean;
  loadingText?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  loading = false,
  action,
  onActionClick,
  confirmationRequired = false,
  loadingText,
  children,
  ...buttonProps
}) => {
  const handleClick = () => {
    if (confirmationRequired) {
      if (window.confirm(`Are you sure you want to ${action.toLowerCase()}?`)) {
        onActionClick();
      }
    } else {
      onActionClick();
    }
  };

  if (loading) {
    return (
      <Button loading variant="outlined" size="sm" {...buttonProps}>
        {loadingText || `${action}ing...`}
      </Button>
    );
  }

  return (
    <Button
      variant="outlined"
      size="sm"
      onClick={handleClick}
      {...buttonProps}
    >
      {children || action}
    </Button>
  );
};

export default ActionButton;
