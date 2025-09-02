import { Close } from "@mui/icons-material";
import { Modal, Box, IconButton } from "@mui/joy";
import React from "react";

interface ModalManagerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string | number;
  fullScreen?: boolean;
  title?: string;
}

const ModalManager: React.FC<ModalManagerProps> = ({
  open,
  onClose,
  children,
  maxWidth = "90vw",
  fullScreen = false,
  title,
}) => {
  const modalStyle = fullScreen
    ? {
        position: "absolute" as const,
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        bgcolor: "background.paper",
        overflow: "auto",
      }
    : {
        position: "absolute" as const,
        top: { xs: 0, md: "50%" },
        left: { xs: 0, md: "50%" },
        transform: { xs: "none", md: "translate(-50%, -50%)" },
        width: { xs: "100%", md: "95%" },
        height: { xs: "100%", md: "auto" },
        maxWidth: { xs: "100%", md: maxWidth },
        maxHeight: { xs: "100%", md: "90vh" },
        bgcolor: "background.paper",
        borderRadius: { xs: 0, md: "lg" },
        boxShadow: { xs: "none", md: "lg" },
        overflow: "auto",
      };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby={title ? `modal-title-${title}` : "modal"}
      aria-describedby="modal-content"
      slotProps={{
        backdrop: {
          timeout: 500,
          sx: { backgroundColor: "rgba(0, 0, 0, 0.7)" },
        },
      }}
    >
      <Box sx={modalStyle}>
        {/* Close button */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            right: 0,
            zIndex: 1000,
            display: "flex",
            justifyContent: "flex-end",
            p: 1,
            backgroundColor: fullScreen
              ? "background.paper"
              : { xs: "background.paper", md: "transparent" },
          }}
        >
          <IconButton
            onClick={onClose}
            size="sm"
            sx={{
              color: "text.secondary",
              backgroundColor: "background.paper",
              boxShadow: "sm",
              "&:hover": {
                backgroundColor: "action.hover",
              },
            }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* Modal content */}
        <Box sx={{ p: fullScreen ? 2 : { xs: 2, md: 3 }, pt: 0 }}>{children}</Box>
      </Box>
    </Modal>
  );
};

export default ModalManager;
